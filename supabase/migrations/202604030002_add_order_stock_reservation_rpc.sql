-- 通过数据库事务函数统一处理订单创建时的库存占用与订单关闭时的库存释放。
-- 目标：
-- 1. 把“校验库存 + 创建订单 + 写入明细 + 扣减库存”收敛到单个事务中
-- 2. 避免并发下单导致的超卖
-- 3. 为待支付订单超时/取消提供统一的库存恢复入口

-- 订单创建事务函数：负责在同一事务内完成参数校验、库存锁定、订单写入与库存扣减。
create or replace function public.create_order_with_reserved_stock(
  p_user_id uuid,
  p_address_id uuid,
  p_delivery_type text,
  p_payment_method text,
  p_notes text default null,
  p_gift_wrap boolean default false,
  p_coupon_id uuid default null,
  p_user_coupon_id uuid default null,
  p_coupon_code text default null,
  p_coupon_title text default null,
  p_coupon_discount numeric default 0,
  p_items jsonb default '[]'::jsonb
)
returns table (
  order_id uuid,
  order_no text,
  subtotal numeric,
  shipping numeric,
  discount numeric,
  auto_discount numeric,
  coupon_discount numeric,
  gift_wrap_fee numeric,
  total numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_subtotal numeric(10, 2);
  v_shipping numeric(10, 2);
  v_auto_discount numeric(10, 2);
  v_coupon_discount numeric(10, 2);
  v_discount numeric(10, 2);
  v_gift_wrap_fee numeric(10, 2);
  v_total numeric(10, 2);
  v_order_id uuid;
  v_order_no text;
  v_address_user_id uuid;
  v_item_count integer;
  v_product_count integer;
begin
  -- 基础参数校验：尽早拒绝无效请求，避免进入库存锁或写入阶段。
  if p_user_id is null then
    raise exception '缺少用户信息。';
  end if;

  if p_address_id is null then
    raise exception '缺少收货地址。';
  end if;

  if p_delivery_type not in ('standard', 'express') then
    raise exception '配送方式无效。';
  end if;

  if p_payment_method not in ('alipay', 'wechat', 'card') then
    raise exception '支付方式无效。';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception '订单商品不能为空。';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where coalesce(trim(item ->> 'productId'), '') = ''
      or coalesce(item ->> 'quantity', '') !~ '^[0-9]+$'
      or (item ->> 'quantity')::integer <= 0
  ) then
    raise exception '订单商品数据无效。';
  end if;

  -- 地址归属校验：防止用户使用他人的收货地址创建订单。
  select user_id
  into v_address_user_id
  from public.addresses
  where id = p_address_id;

  if v_address_user_id is null then
    raise exception '收货地址不存在。';
  end if;

  if v_address_user_id <> p_user_id then
    raise exception '无权使用该收货地址。';
  end if;

  -- 先归并同商品多次传入的数量，后续所有库存与金额计算都基于归并后的结果。
  with normalized_items as (
    select
      trim(item ->> 'productId') as product_id,
      sum((item ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as item
    group by 1
  )
  select count(*)
  into v_item_count
  from normalized_items;

  -- 对商品行加锁并确认所有商品都存在，避免并发下单时读取到不一致状态。
  with normalized_items as (
    select
      trim(item ->> 'productId') as product_id,
      sum((item ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as item
    group by 1
  ),
  locked_products as (
    select
      p.id,
      p.name,
      p.price,
      p.stock,
      p.is_active,
      normalized_items.quantity
    from normalized_items
    join public.products as p
      on p.id = normalized_items.product_id
    for update of p
  )
  select count(*)
  into v_product_count
  from locked_products;

  if v_product_count <> v_item_count then
    raise exception '部分商品不存在或已下架。';
  end if;

  -- 在持有商品行锁的前提下校验可售状态与库存是否充足，防止超卖。
  if exists (
    with normalized_items as (
      select
        trim(item ->> 'productId') as product_id,
        sum((item ->> 'quantity')::integer) as quantity
      from jsonb_array_elements(p_items) as item
      group by 1
    ),
    locked_products as (
      select
        p.id,
        p.name,
        p.price,
        p.stock,
        p.is_active,
        normalized_items.quantity
      from normalized_items
      join public.products as p
        on p.id = normalized_items.product_id
      for update of p
    )
    select 1
    from locked_products
    where is_active is distinct from true
       or price is null
       or (stock is not null and stock < quantity)
  ) then
    raise exception '部分商品库存不足或不可售。';
  end if;

  -- 基于锁定后的商品价格与数量重新计算订单小计，确保金额来自服务端可信数据。
  with normalized_items as (
    select
      trim(item ->> 'productId') as product_id,
      sum((item ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as item
    group by 1
  ),
  locked_products as (
    select
      p.id,
      p.price,
      normalized_items.quantity
    from normalized_items
    join public.products as p
      on p.id = normalized_items.product_id
    for update of p
  )
  select round(sum((price::numeric) * quantity), 2)
  into v_subtotal
  from locked_products;

  -- 统一在数据库内计算运费、自动满减、优惠券抵扣和礼盒费，避免客户端篡改金额。
  v_shipping := case when p_delivery_type = 'express' then 15 else 0 end;
  v_auto_discount := case when coalesce(v_subtotal, 0) >= 1000 then 50 else 0 end;
  v_coupon_discount := round(greatest(coalesce(p_coupon_discount, 0), 0), 2);
  v_discount := v_auto_discount + v_coupon_discount;
  v_gift_wrap_fee := case when coalesce(p_gift_wrap, false) then 28 else 0 end;
  v_total := round(
    coalesce(v_subtotal, 0) + v_shipping - v_discount + v_gift_wrap_fee,
    2
  );

  if v_total <= 0 then
    raise exception '订单金额异常，无法创建订单。';
  end if;

  -- 写入订单主表，订单初始状态固定为待支付。
  insert into public.orders (
    user_id,
    address_id,
    total,
    coupon_id,
    user_coupon_id,
    coupon_code,
    coupon_title,
    coupon_discount,
    delivery_type,
    payment_method,
    payment_channel,
    payment_status,
    notes,
    gift_wrap,
    status,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_address_id,
    v_total,
    p_coupon_id,
    p_user_coupon_id,
    nullif(trim(coalesce(p_coupon_code, '')), ''),
    nullif(trim(coalesce(p_coupon_title, '')), ''),
    v_coupon_discount,
    p_delivery_type,
    p_payment_method,
    p_payment_method,
    'pending_payment',
    v_notes,
    coalesce(p_gift_wrap, false),
    'pending',
    v_now,
    v_now
  )
  returning id, orders.order_no
  into v_order_id, v_order_no;

  -- 写入订单明细，单价使用加锁后的商品价格快照。
  with normalized_items as (
    select
      trim(item ->> 'productId') as product_id,
      sum((item ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as item
    group by 1
  ),
  locked_products as (
    select
      p.id,
      p.price,
      normalized_items.quantity
    from normalized_items
    join public.products as p
      on p.id = normalized_items.product_id
    for update of p
  )
  insert into public.order_items (
    order_id,
    product_id,
    quantity,
    unit_price
  )
  select
    v_order_id,
    locked_products.id,
    locked_products.quantity,
    locked_products.price::numeric
  from locked_products;

  -- 最后正式扣减库存；由于前面已持有行锁，这一步可以避免并发超卖。
  with normalized_items as (
    select
      trim(item ->> 'productId') as product_id,
      sum((item ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as item
    group by 1
  )
  update public.products as products
  set
    stock = products.stock - normalized_items.quantity
  from normalized_items
  where products.id = normalized_items.product_id
    and products.stock is not null;

  -- 返回订单金额拆分结果，供服务端函数继续生成支付单与响应前端。
  return query
  select
    v_order_id,
    v_order_no,
    v_subtotal,
    v_shipping,
    v_discount,
    v_auto_discount,
    v_coupon_discount,
    v_gift_wrap_fee,
    v_total;
end;
$$;

comment on function public.create_order_with_reserved_stock(uuid, uuid, text, text, text, boolean, uuid, uuid, text, text, numeric, jsonb) is
'通过单个数据库事务完成订单创建、库存占用与金额落库，避免并发超卖。';

-- 权限收敛：订单创建与库存占用只能由服务端角色调用，前端不直接执行数据库函数。
revoke all on function public.create_order_with_reserved_stock(uuid, uuid, text, text, text, boolean, uuid, uuid, text, text, numeric, jsonb) from public;
grant execute on function public.create_order_with_reserved_stock(uuid, uuid, text, text, text, boolean, uuid, uuid, text, text, numeric, jsonb) to service_role;

-- 待支付订单关闭函数：负责在同一事务内恢复库存、关闭订单、回写支付流水并释放锁券。
create or replace function public.cancel_pending_order_and_restore_stock(
  p_order_id uuid,
  p_user_id uuid default null,
  p_payment_status text default 'closed',
  p_payment_error_code text default 'order_expired',
  p_payment_error_message text default '待付款订单已超过 10 分钟，系统已自动取消。'
)
returns table (
  released boolean,
  order_status text,
  payment_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_order record;
begin
  -- 先锁定订单行，确保不会与支付成功落库或其他关闭动作并发冲突。
  select
    id,
    user_id,
    status,
    orders.payment_status
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception '订单不存在。';
  end if;

  -- 若调用方显式传入用户 ID，则额外校验订单归属，防止误操作他人订单。
  if p_user_id is not null and v_order.user_id <> p_user_id then
    raise exception '无权操作该订单。';
  end if;

  -- 非待支付订单不重复释放库存，直接返回当前状态，保证函数幂等。
  if v_order.status <> 'pending' then
    return query
    select
      false,
      v_order.status,
      coalesce(v_order.payment_status, p_payment_status);
    return;
  end if;

  -- 汇总订单中预占的商品数量并锁定商品行，再把库存加回去。
  with reserved_items as (
    select
      product_id,
      sum(quantity) as quantity
    from public.order_items
    where order_id = p_order_id
    group by 1
  ),
  locked_products as (
    select
      products.id,
      reserved_items.quantity
    from reserved_items
    join public.products as products
      on products.id = reserved_items.product_id
    for update of products
  )
  update public.products as products
  set
    stock = products.stock + locked_products.quantity
  from locked_products
  where products.id = locked_products.id
    and products.stock is not null;

  -- 回写订单关闭状态与失败原因，统一服务端超时关闭与显式取消的表现。
  update public.orders
  set
    status = 'cancelled',
    payment_status = p_payment_status,
    payment_error_code = p_payment_error_code,
    payment_error_message = p_payment_error_message,
    updated_at = v_now
  where id = p_order_id;

  -- 同步关闭仍处于 created/paying 的支付流水，并记录取消原因到 notify_payload。
  update public.payment_transactions
  set
    status = p_payment_status,
    notify_payload = coalesce(notify_payload, '{}'::jsonb) || jsonb_build_object(
      'type', p_payment_error_code,
      'cancelled_at', v_now
    ),
    notify_verified = true,
    updated_at = v_now
  where order_id = p_order_id
    and status in ('created', 'paying');

  -- 释放被当前订单锁定但尚未使用的用户券，恢复为可用状态。
  update public.user_coupons
  set
    status = 'available',
    locked_at = null,
    lock_expires_at = null,
    order_id = null,
    updated_at = v_now
  where order_id = p_order_id
    and status = 'locked';

  -- 返回关闭结果，供上层服务端函数感知是否真的执行了库存释放。
  return query
  select true, 'cancelled'::text, p_payment_status;
end;
$$;

comment on function public.cancel_pending_order_and_restore_stock(uuid, uuid, text, text, text) is
'关闭待支付订单并释放已占用库存，供服务端过期处理和客户端兜底同步共用。';

-- 先保留 authenticated 授权给历史客户端兜底使用，后续可由独立权限收敛迁移继续回收。
revoke all on function public.cancel_pending_order_and_restore_stock(uuid, uuid, text, text, text) from public;
grant execute on function public.cancel_pending_order_and_restore_stock(uuid, uuid, text, text, text) to authenticated, service_role;
