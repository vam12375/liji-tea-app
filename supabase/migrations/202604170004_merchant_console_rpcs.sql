-- 商家端业务 RPC：9 个 merchant_*() 函数。
-- 统一四步模板：
--   1) 权限校验（is_merchant_staff / is_admin），失败 → raise 'permission_denied' (42501)
--   2) 状态校验（可选），失败 → raise 'state_conflict: <原因>'
--   3) 业务写入
--   4) 调用 _merchant_write_audit 记录审计
-- 任一步失败整个事务回滚。

-- ========== 0. 结构补齐（幂等）==========
-- 售后退款交易号：当前售后域没有，打款打款后用来存第三方交易单号（支付宝/微信）。
alter table public.after_sale_requests
  add column if not exists refund_txn_id text;
comment on column public.after_sale_requests.refund_txn_id is
  '第三方退款交易号，商家线下打款完成后写入。';

-- ========== 1. 审计写入工具（内部）==========
-- 集中收口，所有业务 RPC 尾部调一次即可；revoke execute from public 防止被客户端直接调用。
create or replace function public._merchant_write_audit(
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_payload     jsonb
) returns void language plpgsql security definer as $$
declare
  v_role text;
begin
  select role into v_role from public.user_roles where user_id = auth.uid();
  if v_role is null then
    v_role := 'unknown';
  end if;

  insert into public.merchant_audit_logs(
    actor_id, actor_role, action, target_type, target_id, payload
  ) values (
    auth.uid(), v_role, p_action, p_target_type, p_target_id, coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public._merchant_write_audit(text, text, text, jsonb) from public;

-- ========== 2. 订单履约 RPC ==========

-- 2.1 发货：paid → shipping，写入承运商 / 单号 / shipped_at
create or replace function public.merchant_ship_order(
  p_order_id    uuid,
  p_carrier     text,
  p_tracking_no text
) returns public.orders language plpgsql security definer as $$
declare
  v_order public.orders;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if coalesce(btrim(p_carrier), '') = '' or coalesce(btrim(p_tracking_no), '') = '' then
    raise exception 'invalid_input: carrier/tracking_no required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found: order';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'state_conflict: order status must be paid, got %', v_order.status;
  end if;

  update public.orders
    set status                = 'shipping',
        logistics_company     = p_carrier,
        logistics_tracking_no = p_tracking_no,
        shipped_at            = timezone('utc', now()),
        updated_at            = timezone('utc', now())
    where id = p_order_id
    returning * into v_order;

  perform public._merchant_write_audit(
    'ship_order', 'order', p_order_id::text,
    jsonb_build_object('carrier', p_carrier, 'tracking_no', p_tracking_no)
  );

  return v_order;
end;
$$;

-- 2.2 修正物流信息：仅允许员工，状态不限（允许改已发货订单的单号）
create or replace function public.merchant_update_tracking(
  p_order_id    uuid,
  p_carrier     text,
  p_tracking_no text
) returns public.orders language plpgsql security definer as $$
declare
  v_order public.orders;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  update public.orders
    set logistics_company     = coalesce(nullif(btrim(p_carrier),     ''), logistics_company),
        logistics_tracking_no = coalesce(nullif(btrim(p_tracking_no), ''), logistics_tracking_no),
        updated_at            = timezone('utc', now())
    where id = p_order_id
    returning * into v_order;
  if not found then
    raise exception 'not_found: order';
  end if;

  perform public._merchant_write_audit(
    'update_tracking', 'order', p_order_id::text,
    jsonb_build_object('carrier', p_carrier, 'tracking_no', p_tracking_no)
  );

  return v_order;
end;
$$;

-- 2.3 关闭订单：非终态 → cancelled
create or replace function public.merchant_close_order(
  p_order_id uuid,
  p_reason   text
) returns public.orders language plpgsql security definer as $$
declare
  v_order       public.orders;
  v_from_status text;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'not_found: order';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'state_conflict: order already terminal (%)', v_order.status;
  end if;

  v_from_status := v_order.status;

  update public.orders
    set status     = 'cancelled',
        updated_at = timezone('utc', now())
    where id = p_order_id
    returning * into v_order;

  perform public._merchant_write_audit(
    'close_order', 'order', p_order_id::text,
    jsonb_build_object('reason', p_reason, 'from_status', v_from_status)
  );

  return v_order;
end;
$$;

-- ========== 3. 售后处理 RPC ==========
-- 售后域状态机参考 202604140005_add_after_sale_refund_center.sql：
-- 允许商家流转：submitted / pending_review / auto_approved → approved / rejected
-- approved / refunding → refunded（标记已打款）

-- 3.1 同意退款：可修改最终 approved_amount，写入 audit_note
create or replace function public.merchant_approve_refund(
  p_request_id    uuid,
  p_refund_amount numeric,
  p_note          text
) returns public.after_sale_requests language plpgsql security definer as $$
declare
  v_req public.after_sale_requests;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_refund_amount is null or p_refund_amount <= 0 then
    raise exception 'invalid_input: refund_amount must be > 0';
  end if;

  select * into v_req from public.after_sale_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found: after_sale_request';
  end if;
  if v_req.status not in ('submitted', 'pending_review', 'auto_approved') then
    raise exception 'state_conflict: request must be pending/review, got %', v_req.status;
  end if;

  update public.after_sale_requests
    set status          = 'approved',
        approved_amount = p_refund_amount,
        audit_note      = p_note,
        reviewed_at     = timezone('utc', now()),
        updated_at      = timezone('utc', now())
    where id = p_request_id
    returning * into v_req;

  perform public._merchant_write_audit(
    'approve_refund', 'after_sale', p_request_id::text,
    jsonb_build_object('refund_amount', p_refund_amount, 'note', p_note)
  );

  return v_req;
end;
$$;

-- 3.2 拒绝退款：必须填拒绝理由，写入 audit_note
create or replace function public.merchant_reject_refund(
  p_request_id uuid,
  p_reason     text
) returns public.after_sale_requests language plpgsql security definer as $$
declare
  v_req public.after_sale_requests;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'invalid_input: reason required';
  end if;

  update public.after_sale_requests
    set status      = 'rejected',
        audit_note  = p_reason,
        reviewed_at = timezone('utc', now()),
        updated_at  = timezone('utc', now())
    where id = p_request_id
      and status in ('submitted', 'pending_review', 'auto_approved')
    returning * into v_req;
  if not found then
    raise exception 'state_conflict: request not reviewable or not found';
  end if;

  perform public._merchant_write_audit(
    'reject_refund', 'after_sale', p_request_id::text,
    jsonb_build_object('reason', p_reason)
  );

  return v_req;
end;
$$;

-- 3.3 标记已打款：approved / refunding → refunded，记录退款交易号
create or replace function public.merchant_mark_refund_completed(
  p_request_id uuid,
  p_txn_id     text
) returns public.after_sale_requests language plpgsql security definer as $$
declare
  v_req public.after_sale_requests;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if coalesce(btrim(p_txn_id), '') = '' then
    raise exception 'invalid_input: txn_id required';
  end if;

  update public.after_sale_requests
    set status        = 'refunded',
        refund_txn_id = p_txn_id,
        refund_note   = coalesce(refund_note, '') ||
                          case when coalesce(refund_note, '') = '' then '' else E'\n' end ||
                          '打款交易号：' || p_txn_id,
        refunded_at   = timezone('utc', now()),
        updated_at    = timezone('utc', now())
    where id = p_request_id
      and status in ('approved', 'refunding')
    returning * into v_req;
  if not found then
    raise exception 'state_conflict: request not approved or not found';
  end if;

  perform public._merchant_write_audit(
    'complete_refund', 'after_sale', p_request_id::text,
    jsonb_build_object('txn_id', p_txn_id)
  );

  return v_req;
end;
$$;

-- ========== 4. 商品 / 库存 RPC ==========

-- 4.1 更新商品：patch 走白名单，防止员工误/恶意改非预期字段
create or replace function public.merchant_update_product(
  p_product_id uuid,
  p_patch      jsonb
) returns public.products language plpgsql security definer as $$
declare
  v_product public.products;
  v_allowed text[] := array['name', 'price', 'description', 'is_active', 'image_url', 'tagline'];
  v_key     text;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'invalid_input: field % not updatable', v_key;
    end if;
  end loop;

  update public.products
    set name        = coalesce(p_patch->>'name',        name),
        price       = coalesce((p_patch->>'price')::numeric, price),
        description = coalesce(p_patch->>'description', description),
        is_active   = coalesce((p_patch->>'is_active')::boolean, is_active),
        image_url   = coalesce(p_patch->>'image_url',   image_url),
        tagline     = coalesce(p_patch->>'tagline',     tagline)
    where id = p_product_id
    returning * into v_product;
  if not found then
    raise exception 'not_found: product';
  end if;

  perform public._merchant_write_audit(
    'update_product', 'product', p_product_id::text, p_patch
  );

  return v_product;
end;
$$;

-- 4.2 库存调整：delta 可正可负；负数减到 0 为止；必须填原因
create or replace function public.merchant_update_stock(
  p_product_id uuid,
  p_delta      integer,
  p_reason     text
) returns public.products language plpgsql security definer as $$
declare
  v_product public.products;
begin
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_input: delta must be non-zero';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'invalid_input: reason required';
  end if;

  update public.products
    set stock = greatest(0, coalesce(stock, 0) + p_delta)
    where id = p_product_id
    returning * into v_product;
  if not found then
    raise exception 'not_found: product';
  end if;

  perform public._merchant_write_audit(
    'update_stock', 'product', p_product_id::text,
    jsonb_build_object('delta', p_delta, 'reason', p_reason, 'stock_after', v_product.stock)
  );

  return v_product;
end;
$$;

-- ========== 5. 角色授予 RPC（仅 admin）==========

-- 5.1 授予 / 撤销角色：p_role 传 null 表示撤销
create or replace function public.merchant_grant_role(
  p_user_id uuid,
  p_role    text
) returns public.user_roles language plpgsql security definer as $$
declare
  v_row public.user_roles;
begin
  if not public.is_admin() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_role is not null and p_role not in ('admin', 'staff') then
    raise exception 'invalid_input: role must be admin or staff or null';
  end if;

  if p_role is null then
    delete from public.user_roles where user_id = p_user_id returning * into v_row;
    perform public._merchant_write_audit(
      'grant_role', 'user_role', p_user_id::text,
      jsonb_build_object('role', null)
    );
    return v_row;
  end if;

  insert into public.user_roles(user_id, role, created_by)
    values (p_user_id, p_role, auth.uid())
  on conflict (user_id) do update
    set role       = excluded.role,
        created_by = excluded.created_by
    returning * into v_row;

  perform public._merchant_write_audit(
    'grant_role', 'user_role', p_user_id::text,
    jsonb_build_object('role', p_role)
  );

  return v_row;
end;
$$;

-- ========== 6. 对外 grant ==========
-- 业务 RPC 全部开放给 authenticated；权限判定由函数内部负责。

grant execute on function public.merchant_ship_order(uuid, text, text)                to authenticated;
grant execute on function public.merchant_update_tracking(uuid, text, text)           to authenticated;
grant execute on function public.merchant_close_order(uuid, text)                     to authenticated;
grant execute on function public.merchant_approve_refund(uuid, numeric, text)         to authenticated;
grant execute on function public.merchant_reject_refund(uuid, text)                   to authenticated;
grant execute on function public.merchant_mark_refund_completed(uuid, text)           to authenticated;
grant execute on function public.merchant_update_product(uuid, jsonb)                 to authenticated;
grant execute on function public.merchant_update_stock(uuid, integer, text)           to authenticated;
grant execute on function public.merchant_grant_role(uuid, text)                      to authenticated;
