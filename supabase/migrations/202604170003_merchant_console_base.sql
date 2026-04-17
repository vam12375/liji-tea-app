-- 商家端基础迁移：角色表 + 审计表 + 角色判定函数 + 现有表 SELECT RLS 增量。
-- 业务 RPC 见后续迁移 202604170004_merchant_console_rpcs.sql。

-- ========== 1. 角色表 ==========
-- 一个用户一个角色，MVP 范围内够用；细粒度权限矩阵是 V2 的事。
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','staff')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on table public.user_roles is
  '商家端员工角色表：仅标记 admin / staff；未登记视为普通顾客。';

-- ========== 2. 审计表 ==========
-- 每个 merchant_*() RPC 在事务末尾统一写一条，出事能追溯。
create table if not exists public.merchant_audit_logs (
  id          bigserial primary key,
  actor_id    uuid not null references auth.users(id),
  actor_role  text not null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

-- 按 target 维度查：例如某笔订单的全部商家操作
create index if not exists merchant_audit_logs_target_idx
  on public.merchant_audit_logs (target_type, target_id, created_at desc);

-- 按操作人维度查：例如某员工最近一周的全部动作
create index if not exists merchant_audit_logs_actor_idx
  on public.merchant_audit_logs (actor_id, created_at desc);

comment on table public.merchant_audit_logs is
  '商家写操作审计：所有 merchant_*() RPC 事务末尾统一落一条。';

-- ========== 3. 角色判定函数 ==========
-- stable + security definer：RLS 策略与业务 RPC 都会调用，避免重复 sql。
create or replace function public.is_merchant_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','staff')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

comment on function public.is_merchant_staff() is
  '当前登录用户是否为 admin 或 staff（商家端员工）。';
comment on function public.is_admin() is
  '当前登录用户是否为 admin（商家端管理员）。';

-- ========== 4. 新表 RLS ==========
-- 两张新表都开启 RLS；写入路径由后续迁移的 merchant_*() RPC（security definer）收口。
alter table public.user_roles          enable row level security;
alter table public.merchant_audit_logs enable row level security;

-- 用户可看自己的角色记录；admin 可看全部；写入一律走 RPC，客户端不开放。
drop policy if exists user_roles_select_self_or_admin on public.user_roles;
create policy user_roles_select_self_or_admin on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

-- 审计日志只允许员工读，禁止任何客户端直接写入。
drop policy if exists merchant_audit_logs_select_staff on public.merchant_audit_logs;
create policy merchant_audit_logs_select_staff on public.merchant_audit_logs
  for select using (public.is_merchant_staff());

-- ========== 5. 现有表 SELECT RLS 增量 ==========
-- 仅新增一条 additive 策略放开员工读全量，不动既有顾客策略。
-- 写操作保持原状，不暴露给客户端；商家写入全部走后续的 merchant_*() RPC。

drop policy if exists products_select_merchant on public.products;
create policy products_select_merchant on public.products
  for select using (public.is_merchant_staff());

drop policy if exists orders_select_merchant on public.orders;
create policy orders_select_merchant on public.orders
  for select using (public.is_merchant_staff());

drop policy if exists order_items_select_merchant on public.order_items;
create policy order_items_select_merchant on public.order_items
  for select using (public.is_merchant_staff());

drop policy if exists after_sale_requests_select_merchant on public.after_sale_requests;
create policy after_sale_requests_select_merchant on public.after_sale_requests
  for select using (public.is_merchant_staff());
