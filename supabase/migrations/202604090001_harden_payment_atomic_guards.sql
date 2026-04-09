--加固支付原子边界：限制非法状态迁移，并补充支付流水唯一约束。

create unique index if not exists payment_transactions_trade_no_key
  on public.payment_transactions (trade_no)
  where trade_no is not null;

comment on index public.payment_transactions_trade_no_key is
'第三方交易号唯一索引，防止同一 trade_no 被重复映射到不同订单。';

create or replace function public.atomic_init_payment(
  p_order_id uuid,
  p_user_id uuid,
  p_channel text,
  p_out_trade_no text,
  p_amount numeric,
  p_subject text,
  p_item_count integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_order record;
  v_existing_tx record;
  v_result json;
begin
  select
id,
    user_id,
    status,
    payment_status,
    out_trade_no
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.user_id <> p_user_id then
    raise exception 'forbidden';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'invalid_order_status';
  end if;

  if v_order.payment_status = 'success' then
    raise exception 'order_already_paid';
  end if;

if v_order.out_trade_no is not null and v_order.out_trade_no <> p_out_trade_no then
    raise exception 'out_trade_no_mismatch';
  end if;

  select
    id,
    order_id,
    status
  into v_existing_tx
  from public.payment_transactions
  where out_trade_no = p_out_trade_no
  for update;

  if found and v_existing_tx.order_id <> p_order_id then
    raise exception 'out_trade_no_already_used';
  end if;

  update public.orders
  set
    total = p_amount,
payment_channel = p_channel,
    payment_status = 'paying',
    out_trade_no = p_out_trade_no,
    payment_error_code = null,
    payment_error_message = null,
    updated_at = v_now
  where id = p_order_id;

  insert into public.payment_transactions (
    order_id,
user_id,
    channel,
    out_trade_no,
    amount,
    status,
    request_payload,
    notify_verified,
    updated_at
  )
  values (
    p_order_id,
    p_user_id,
p_channel,
    p_out_trade_no,
    p_amount,
    'paying',
    jsonb_build_object(
      'orderId', p_order_id,
      'amount', p_amount::text,
      'subject', p_subject,
      'itemCount', p_item_count
    ),
    false,
    v_now
  )
  on conflict (out_trade_no)
  do update set
    amount = excluded.amount,
    status = case
      when public.payment_transactions.status = 'success' then public.payment_transactions.status
      else excluded.status
    end,
    request_payload = excluded.request_payload,
    updated_at = excluded.updated_at;

  v_result := json_build_object(
    'success', true,
    'updated_at', v_now
  );

  return v_result;
end;
$$;

comment on function public.atomic_init_payment(uuid, uuid, text, text, numeric, text, integer) is
'原子性初始化支付流程，限制非法状态迁移并确保 out_trade_no 不被跨订单复用。';

revoke all on function public.atomic_init_payment(uuid, uuid, text, text, numeric, text, integer) from public;
grant execute on function public.atomic_init_payment(uuid, uuid, text, text, numeric, text, integer)to service_role;

create or replace function public.mark_order_paid_atomic(
  p_order_id uuid,
  p_channel text,
  p_payment_status text,
  p_out_trade_no text,
  p_trade_no text,
  p_paid_at timestamptz,
p_paid_amount numeric,
  p_payment_error_code text default null,
  p_payment_error_message text default null,
  p_request_payload jsonb default null,
  p_notify_payload jsonb default null,
  p_notify_verified boolean default false,
  p_logistics_company text default null,
p_logistics_tracking_no text default null,
  p_logistics_receiver_name text default null,
  p_logistics_receiver_phone text default null,
  p_logistics_address text default null,
p_tracking_events jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_paid_at, timezone('utc', now()));
  v_order record;
  v_coupon_rows_updated integer := 0;
v_existing_tx_order_id uuid;
begin
  select
    id,
    user_id,
    status,
    coupon_id,
    user_coupon_id,
    out_trade_no,
    payment_status,
    paid_at,
    paid_amount,
    trade_no
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception '订单不存在。';
  end if;

  if v_order.status = 'paid' and v_order.payment_status = 'success' then
    if coalesce(v_order.out_trade_no, '') <> coalesce(p_out_trade_no, '') then
      raise exception '支付单号与已支付订单不一致。';
    end if;

if coalesce(v_order.trade_no, '') <> coalesce(p_trade_no, coalesce(v_order.trade_no, '')) then
      raise exception '第三方交易号与已支付订单不一致。';
    end if;

    return jsonb_build_object(
      'success', true,
      'updated_at', coalesce(v_order.paid_at, v_now),
      'coupon_marked_used', false,
      'already_paid', true
    );
  end if;

  if v_order.status <> 'pending' then
    raise exception '仅待支付订单允许标记为已支付。';
  end if;

  if v_order.out_trade_no is not null and v_order.out_trade_no <> p_out_trade_no then
    raise exception '订单 out_trade_no 与支付回写不一致。';
  end if;

  if p_trade_no is not null then
    select order_id
into v_existing_tx_order_id
    from public.payment_transactions
    where trade_no = p_trade_no
      and out_trade_no <> p_out_trade_no
    limit 1;

    if found and v_existing_tx_order_id <> p_order_id then
      raise exception '第三方交易号已关联其他订单。';
    end if;
  end if;

  update public.orders
  set
    status = 'paid',
    payment_channel = p_channel,
    payment_status = p_payment_status,
    out_trade_no = p_out_trade_no,
    trade_no = p_trade_no,
    paid_amount = p_paid_amount,
    paid_at = v_now,
    payment_error_code= p_payment_error_code,
    payment_error_message = p_payment_error_message,
    logistics_company = p_logistics_company,
    logistics_tracking_no = p_logistics_tracking_no,
    logistics_status = 'pending',
    logistics_receiver_name = p_logistics_receiver_name,
logistics_receiver_phone = p_logistics_receiver_phone,
    logistics_address = p_logistics_address,
    shipped_at = null,
    delivered_at = null,
    updated_at = v_now
  where id = p_order_id;

  insert into public.payment_transactions (
    order_id,
    user_id,
channel,
    out_trade_no,
    trade_no,
    amount,
    status,
    request_payload,
    notify_payload,
    notify_verified,
    updated_at
  )
  values (
    p_order_id,
    v_order.user_id,
    p_channel,
p_out_trade_no,
    p_trade_no,
    p_paid_amount,
    p_payment_status,
    p_request_payload,
    p_notify_payload,
    p_notify_verified,
    v_now
  )
  on conflict (out_trade_no)
  do update set
    order_id = excluded.order_id,
    user_id =excluded.user_id,
    channel = excluded.channel,
    trade_no = coalesce(excluded.trade_no, public.payment_transactions.trade_no),
    amount = excluded.amount,
    status = case
when public.payment_transactions.status = 'success' then public.payment_transactions.status
      else excluded.status
    end,
    request_payload = coalesce(excluded.request_payload, public.payment_transactions.request_payload),
    notify_payload = coalesce(excluded.notify_payload, public.payment_transactions.notify_payload),
    notify_verified= public.payment_transactions.notify_verified or excluded.notify_verified,
    updated_at = excluded.updated_at;

  if v_order.user_coupon_id is not null then
    update public.user_coupons
    set
      status = 'used',
      used_at = v_now,
      locked_at = null,
lock_expires_at = null,
      order_id = p_order_id,
      updated_at = v_now
    where id = v_order.user_coupon_id
      and status = 'locked'
      and order_id = p_order_id;

    get diagnostics v_coupon_rows_updated = row_count;

    if v_coupon_rows_updated > 0 and v_order.coupon_id is not null then
      update public.coupons
      set
        used_count = coalesce(used_count, 0) + 1,
        updated_at = v_now
      where id = v_order.coupon_id;
    end if;
  end if;

  delete from public.order_tracking_events
  where order_id = p_order_id;

insert into public.order_tracking_events (
    order_id,
    user_id,
    status,
    title,
    detail,
    event_time,
    sort_order
  )
  select
    p_order_id,
    v_order.user_id,
    item.status,
    item.title,
item.detail,
    coalesce(item.event_time, v_now),
    coalesce(item.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_tracking_events, '[]'::jsonb)) as item(
    status text,
    title text,
detail text,
    event_time timestamptz,
    sort_order integer
  )
  where item.status is not null
    and item.title is not null
    and item.detail is not null;

  return jsonb_build_object(
    'success', true,
    'updated_at', v_now,
    'coupon_marked_used', v_coupon_rows_updated > 0,
    'already_paid', false
  );
end;
$$;

comment on function public.mark_order_paid_atomic(uuid, text, text, text, text, timestamptz, numeric, text, text, jsonb, jsonb, boolean, text, text, text, text, text, jsonb) is
'原子性收口支付成功流程，补充非法状态拦截、重复支付保护和 trade_no 唯一约束校验。';

revoke all on function public.mark_order_paid_atomic(uuid,text, text, text, text, timestamptz, numeric, text, text, jsonb, jsonb, boolean, text, text, text, text, text, jsonb) from public;
grant execute on function public.mark_order_paid_atomic(uuid, text, text, text, text,timestamptz, numeric, text, text, jsonb, jsonb, boolean, text, text, text, text, text, jsonb) to service_role;
