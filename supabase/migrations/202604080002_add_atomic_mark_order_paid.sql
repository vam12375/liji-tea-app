-- 原子性收口支付成功：统一更新订单、支付流水、优惠券和物流轨迹。

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
begin
  -- 锁定订单行，避免与超时关单、重复 notify 或其他支付回写并发冲突。
  select
    id,
    user_id,
    coupon_id,
    user_coupon_id
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception '订单不存在。';
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
    payment_error_code = p_payment_error_code,
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
    user_id = excluded.user_id,
    channel = excluded.channel,
    trade_no = excluded.trade_no,
    amount = excluded.amount,
    status = excluded.status,
    request_payload = excluded.request_payload,
    notify_payload = excluded.notify_payload,
    notify_verified = excluded.notify_verified,
    updated_at = excluded.updated_at;

  -- 只有从 locked -> used 的首次转移才递增已使用次数，保证幂等。
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
    'coupon_marked_used', v_coupon_rows_updated > 0
  );
end;
$$;

comment on function public.mark_order_paid_atomic(uuid, text, text, text, text, timestamptz, numeric, text, text, jsonb, jsonb, boolean, text, text, text, text, text, jsonb) is
'原子性收口支付成功流程，同时更新订单、支付流水、优惠券状态和物流轨迹。';

revoke all on function public.mark_order_paid_atomic(uuid, text, text, text, text, timestamptz, numeric, text, text, jsonb, jsonb, boolean, text, text, text, text, text, jsonb) from public;
grant execute on function public.mark_order_paid_atomic(uuid, text, text, text, text, timestamptz, numeric, text, text, jsonb, jsonb, boolean, text, text, text, text, text, jsonb) to service_role;
