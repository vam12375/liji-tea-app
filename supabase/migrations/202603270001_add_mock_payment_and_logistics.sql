-- 为模拟支付与模拟物流补充订单履约字段。
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists logistics_company text;
alter table public.orders add column if not exists logistics_tracking_no text;
alter table public.orders add column if not exists logistics_status text;
alter table public.orders add column if not exists logistics_receiver_name text;
alter table public.orders add column if not exists logistics_receiver_phone text;
alter table public.orders add column if not exists logistics_address text;

comment on column public.orders.shipped_at is '订单实际发货时间，用于物流页展示。';
comment on column public.orders.delivered_at is '订单签收时间，用于物流页展示。';
comment on column public.orders.logistics_company is '物流公司名称，模拟物流使用。';
comment on column public.orders.logistics_tracking_no is '物流单号，模拟物流使用。';
comment on column public.orders.logistics_status is '物流状态，例如 pending、packed、shipped、in_transit、delivered。';
comment on column public.orders.logistics_receiver_name is '物流收件人姓名快照。';
comment on column public.orders.logistics_receiver_phone is '物流收件人手机号快照。';
comment on column public.orders.logistics_address is '物流收货地址快照。';

create index if not exists orders_logistics_tracking_no_idx
  on public.orders (logistics_tracking_no)
  where logistics_tracking_no is not null;

comment on index public.orders_logistics_tracking_no_idx is '订单表物流单号查询索引。';

-- 支付流水表状态补充，兼容模拟支付链路。
comment on column public.payment_transactions.channel is '支付渠道，例如 alipay、wechat、card。';
comment on column public.payment_transactions.status is '支付流水状态，例如 created、paying、success、failed、closed。';

-- 模拟物流轨迹表。
create table if not exists public.order_tracking_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  title text not null,
  detail text not null,
  event_time timestamptz not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.order_tracking_events is '订单物流轨迹事件表，保存模拟物流节点与时间线。';
comment on column public.order_tracking_events.order_id is '关联订单 ID。';
comment on column public.order_tracking_events.user_id is '关联用户 ID。';
comment on column public.order_tracking_events.status is '轨迹节点状态，例如 paid、packed、shipped、in_transit、delivered。';
comment on column public.order_tracking_events.title is '轨迹节点标题。';
comment on column public.order_tracking_events.detail is '轨迹节点详情。';
comment on column public.order_tracking_events.event_time is '轨迹节点发生时间。';
comment on column public.order_tracking_events.sort_order is '轨迹节点排序，值越小越靠前。';

create index if not exists order_tracking_events_order_id_idx
  on public.order_tracking_events (order_id, event_time desc, sort_order asc);

create index if not exists order_tracking_events_user_id_idx
  on public.order_tracking_events (user_id);

comment on index public.order_tracking_events_order_id_idx is '订单物流轨迹按订单查询索引。';
comment on index public.order_tracking_events_user_id_idx is '订单物流轨迹按用户查询索引。';
