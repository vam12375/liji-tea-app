-- 202604190001 新增客户端崩溃 / 异常上报基建。
--
-- 设计取舍（KISS）：
-- - 一张平坦表 `crash_reports`：id / user_id / scope / message / stack / context / meta / created_at。
-- - 未登录上报允许（user_id 为 null），便于跑启动期异常。
-- - RLS：用户只能看自己的；admin 可看全部；写入一律走 Edge Function（security definer 绕过）。
-- - 历史归档 / TTL 策略留给后续独立迁移，避免本迁移膨胀。

create table if not exists public.crash_reports (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  scope       text not null,
  message     text not null,
  stack       text,
  context     jsonb,
  app_version text,
  platform    text,
  created_at  timestamptz not null default now()
);

comment on table public.crash_reports is
  '客户端崩溃 / captureError 远端上报聚合表；写入走 report-crash Edge Function。';

-- 按用户 + 时间倒序查自己的崩溃历史；这是用户端最常用的查询路径。
create index if not exists crash_reports_user_created_idx
  on public.crash_reports (user_id, created_at desc);

-- 按 scope + 时间倒序做维度聚合分析，例如 "payment 域最近 24h 有多少错"。
create index if not exists crash_reports_scope_created_idx
  on public.crash_reports (scope, created_at desc);

alter table public.crash_reports enable row level security;

-- 用户只能读取自己的崩溃日志，便于"我的反馈"类页面回查。
drop policy if exists crash_reports_select_own_or_admin on public.crash_reports;
create policy crash_reports_select_own_or_admin on public.crash_reports
  for select using (
    user_id = auth.uid() or public.is_admin()
  );

-- 直接禁止客户端任何写路径，所有 INSERT 都由 report-crash Edge Function 代为完成。
-- 这样可以对 payload 做大小/批量限制，同时避免伪造 user_id。
drop policy if exists crash_reports_no_direct_write on public.crash_reports;
create policy crash_reports_no_direct_write on public.crash_reports
  for insert with check (false);
