-- 新增优惠券主表、用户领券表，以及订单用券字段。
-- 目标：
-- 1. 建立优惠券中心与用户领券记录的基础数据结构
-- 2. 为订单补充用券快照字段，避免后续优惠券信息变更影响历史订单展示
-- 3. 通过 RLS 约束用户券访问范围，只允许用户读取自己的领券记录

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  code text not null unique,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value numeric(10, 2) not null check (discount_value > 0),
  min_spend numeric(10, 2) not null default 0 check (min_spend >= 0),
  max_discount numeric(10, 2) check (max_discount is null or max_discount > 0),
  total_limit integer check (total_limit is null or total_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  claimed_count integer not null default 0 check (claimed_count >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.coupons is '优惠券主表：定义优惠券名称、门槛、折扣规则、库存限制与生效时间。';
comment on column public.coupons.title is '优惠券标题，用于前端展示。';
comment on column public.coupons.description is '优惠券说明文案，可展示使用条件或活动信息。';
comment on column public.coupons.code is '优惠券编码，供运营配置与外部识别使用。';
comment on column public.coupons.discount_type is '优惠类型：fixed 表示固定减免，percent 表示按百分比折扣。';
comment on column public.coupons.discount_value is '优惠数值：固定减免金额或折扣百分比。';
comment on column public.coupons.min_spend is '使用门槛金额，订单达到该金额后方可使用。';
comment on column public.coupons.max_discount is '折扣类优惠的最大减免金额上限。';
comment on column public.coupons.total_limit is '整张券的总可领取/可发放上限，空表示不限量。';
comment on column public.coupons.per_user_limit is '单个用户最多可领取次数。';
comment on column public.coupons.claimed_count is '已领取次数统计。';
comment on column public.coupons.used_count is '已核销次数统计。';
comment on column public.coupons.starts_at is '优惠券开始生效时间。';
comment on column public.coupons.ends_at is '优惠券结束生效时间。';
comment on column public.coupons.is_active is '运营启用状态，false 表示下线不可领取。';
comment on column public.coupons.created_at is '记录创建时间（UTC）。';
comment on column public.coupons.updated_at is '记录最近更新时间（UTC）。';

create table if not exists public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'available' check (status in ('available', 'locked', 'used', 'expired')),
  claimed_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  lock_expires_at timestamptz,
  used_at timestamptz,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.user_coupons is '用户领券记录表：跟踪每位用户领取、锁定、使用、过期的优惠券实例。';
comment on column public.user_coupons.coupon_id is '关联的优惠券主表 ID。';
comment on column public.user_coupons.user_id is '领券用户 ID，对应 auth.users。';
comment on column public.user_coupons.status is '用户券状态：available 可用、locked 已锁定、used 已使用、expired 已过期。';
comment on column public.user_coupons.claimed_at is '用户领取优惠券时间。';
comment on column public.user_coupons.locked_at is '优惠券被订单锁定时间。';
comment on column public.user_coupons.lock_expires_at is '锁券过期时间，超时后可回收。';
comment on column public.user_coupons.used_at is '优惠券实际核销时间。';
comment on column public.user_coupons.order_id is '当前锁定或已使用该券的订单 ID。';
comment on column public.user_coupons.created_at is '记录创建时间（UTC）。';
comment on column public.user_coupons.updated_at is '记录最近更新时间（UTC）。';

-- 为运营筛选有效优惠券、用户查看券包与订单反查用户券建立索引。
create index if not exists idx_coupons_active_window
  on public.coupons (is_active, starts_at, ends_at);
comment on index public.idx_coupons_active_window is '按启用状态与生效窗口过滤优惠券，提升可领券列表查询性能。';

create index if not exists idx_user_coupons_user_status
  on public.user_coupons (user_id, status, claimed_at desc);
comment on index public.idx_user_coupons_user_status is '按用户、状态、领取时间查询用户券列表，提升券包页与状态筛选性能。';

create index if not exists idx_user_coupons_coupon_user
  on public.user_coupons (coupon_id, user_id);
comment on index public.idx_user_coupons_coupon_user is '支持按券种与用户统计领取次数，便于校验每人限领。';

create unique index if not exists idx_user_coupons_order_unique
  on public.user_coupons (order_id)
  where order_id is not null;
comment on index public.idx_user_coupons_order_unique is '保证单个订单最多关联一张用户券实例，避免重复绑定。';

-- 在订单表中固化用券快照，避免优惠券标题或编码调整后影响历史订单展示。
alter table public.orders
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
comment on column public.orders.coupon_id is '订单关联的优惠券主表 ID。';

alter table public.orders
  add column if not exists user_coupon_id uuid references public.user_coupons(id) on delete set null;
comment on column public.orders.user_coupon_id is '订单实际使用的用户券实例 ID。';

alter table public.orders
  add column if not exists coupon_code text;
comment on column public.orders.coupon_code is '下单时快照保存的优惠券编码。';

alter table public.orders
  add column if not exists coupon_title text;
comment on column public.orders.coupon_title is '下单时快照保存的优惠券标题。';

alter table public.orders
  add column if not exists coupon_discount numeric(10, 2) not null default 0;
comment on column public.orders.coupon_discount is '订单实际使用的优惠券减免金额快照。';

-- 开启 RLS：优惠券主表允许公开读取有效券，用户券仅允许本人读取。
alter table public.coupons enable row level security;
alter table public.user_coupons enable row level security;

drop policy if exists "Coupons are publicly readable" on public.coupons;
create policy "Coupons are publicly readable"
on public.coupons for select
using (
  is_active = true
  and (starts_at is null or starts_at <= timezone('utc', now()))
  and (ends_at is null or ends_at >= timezone('utc', now()))
);
comment on policy "Coupons are publicly readable" on public.coupons is '允许前端读取当前已启用且处于有效期内的优惠券。';

drop policy if exists "Users view own user coupons" on public.user_coupons;
create policy "Users view own user coupons"
on public.user_coupons for select
using (auth.uid() = user_id);
comment on policy "Users view own user coupons" on public.user_coupons is '仅允许登录用户读取自己的领券记录。';
