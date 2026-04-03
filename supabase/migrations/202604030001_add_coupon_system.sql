-- 新增优惠券主表、用户领券表，以及订单用券字段。

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

create index if not exists idx_coupons_active_window
  on public.coupons (is_active, starts_at, ends_at);

create index if not exists idx_user_coupons_user_status
  on public.user_coupons (user_id, status, claimed_at desc);

create index if not exists idx_user_coupons_coupon_user
  on public.user_coupons (coupon_id, user_id);

create unique index if not exists idx_user_coupons_order_unique
  on public.user_coupons (order_id)
  where order_id is not null;

alter table public.orders
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null;

alter table public.orders
  add column if not exists user_coupon_id uuid references public.user_coupons(id) on delete set null;

alter table public.orders
  add column if not exists coupon_code text;

alter table public.orders
  add column if not exists coupon_title text;

alter table public.orders
  add column if not exists coupon_discount numeric(10, 2) not null default 0;

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

drop policy if exists "Users view own user coupons" on public.user_coupons;
create policy "Users view own user coupons"
on public.user_coupons for select
using (auth.uid() = user_id);
