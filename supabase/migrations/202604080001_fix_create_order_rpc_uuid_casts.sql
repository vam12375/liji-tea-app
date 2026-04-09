-- 修复 create_order_with_reserved_stock 内部将商品 UUID 按 text 比较的问题。
-- 原实现从 jsonb 取出的 productId 是 text，后续直接与 products.id(uuid) 比较，
-- 在 PostgreSQL 中会触发 “operator does not exist: uuid = text”。

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

  -- productId 必须是合法 UUID，避免后续把 text 直接和 uuid 列比较。
  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    where coalesce(trim(item ->> 'productId'), '') = ''
      or trim(item ->> 'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
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
      (trim(item ->> 'productId'))::uuid as product_id,
      sum((item ->> 'quantity')::integer) as quantity
    from jsonb_array_elements(p_items) as item
    group by 1
  )
  select count(*)
  into v_item_count
  from normalized_items;

  -- 对商品行加锁并确认所有商品都存在，避免并发下单时读到不一致状态。
  with normalized_items as (
    select
      (trim(item ->> 'productId'))::uuid as product_id,
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
        (trim(item ->> 'productId'))::uuid as product_id,
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
      (trim(item ->> 'productId'))::uuid as product_id,
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
      (trim(item ->> 'productId'))::uuid as product_id,
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
      (trim(item ->> 'productId'))::uuid as product_id,
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
'通过单个数据库事务完成订单创建、库存占用与金额落库，并显式将商品 productId 转成 uuid，避免 uuid 与 text 比较报错。';
