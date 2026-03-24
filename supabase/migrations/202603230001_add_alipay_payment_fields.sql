-- 为订单表补充支付宝支付相关字段。
alter table public.orders add column if not exists payment_channel text;
alter table public.orders add column if not exists payment_status text;
alter table public.orders add column if not exists out_trade_no text;
alter table public.orders add column if not exists paid_amount numeric(10, 2);
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists trade_no text;
alter table public.orders add column if not exists payment_error_code text;
alter table public.orders add column if not exists payment_error_message text;

comment on column public.orders.payment_channel is '支付渠道，例如 alipay。';
comment on column public.orders.payment_status is '支付状态，例如 pending_payment、paying、success、failed、closed。';
comment on column public.orders.out_trade_no is '商户侧支付单号，对应支付宝 out_trade_no。';
comment on column public.orders.paid_amount is '实际支付金额，以服务端验签后的金额为准。';
comment on column public.orders.paid_at is '支付成功时间，以服务端确认时间为准。';
comment on column public.orders.trade_no is '支付宝交易号，对应支付宝 trade_no。';
comment on column public.orders.payment_error_code is '支付失败或关闭时记录的错误码。';
comment on column public.orders.payment_error_message is '支付失败或关闭时记录的错误信息。';

-- 为商户支付单号建立唯一索引，避免重复落库。
create unique index if not exists orders_out_trade_no_key
  on public.orders (out_trade_no)
  where out_trade_no is not null;

comment on index public.orders_out_trade_no_key is '订单表商户支付单号唯一索引。';

-- 将历史数据中的支付方式回填到 payment_channel。
update public.orders
set payment_channel = coalesce(payment_channel, payment_method)
where payment_method is not null;

-- 将历史订单状态映射到新的支付状态字段。
update public.orders
set payment_status = coalesce(
  payment_status,
  case
    when status = 'paid' then 'success'
    when status = 'cancelled' then 'closed'
    else 'pending_payment'
  end
);

-- 新增支付流水表，用于记录支付请求、异步通知和验签结果。
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  out_trade_no text not null unique,
  trade_no text,
  amount numeric(10, 2) not null,
  status text not null default 'created',
  request_payload jsonb,
  notify_payload jsonb,
  notify_verified boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.payment_transactions is '支付流水表，记录支付请求、回调通知及验签结果。';
comment on column public.payment_transactions.id is '支付流水主键。';
comment on column public.payment_transactions.order_id is '关联订单 ID。';
comment on column public.payment_transactions.user_id is '关联用户 ID。';
comment on column public.payment_transactions.channel is '支付渠道，例如 alipay。';
comment on column public.payment_transactions.out_trade_no is '商户侧支付单号。';
comment on column public.payment_transactions.trade_no is '第三方支付平台交易号，例如支付宝 trade_no。';
comment on column public.payment_transactions.amount is '本次支付流水对应金额。';
comment on column public.payment_transactions.status is '支付流水状态，例如 created、paying、success、closed。';
comment on column public.payment_transactions.request_payload is '创建支付单时发送或保存的请求载荷。';
comment on column public.payment_transactions.notify_payload is '第三方支付回调原始载荷。';
comment on column public.payment_transactions.notify_verified is '回调签名是否已验证通过。';
comment on column public.payment_transactions.created_at is '支付流水创建时间。';
comment on column public.payment_transactions.updated_at is '支付流水最近更新时间。';

-- 为常用查询字段建立索引，便于按订单、用户和状态查询支付流水。
create index if not exists payment_transactions_order_id_idx
  on public.payment_transactions (order_id);

create index if not exists payment_transactions_user_id_idx
  on public.payment_transactions (user_id);

create index if not exists payment_transactions_status_idx
  on public.payment_transactions (status);

comment on index public.payment_transactions_order_id_idx is '支付流水按订单查询索引。';
comment on index public.payment_transactions_user_id_idx is '支付流水按用户查询索引。';
comment on index public.payment_transactions_status_idx is '支付流水按状态查询索引。';
