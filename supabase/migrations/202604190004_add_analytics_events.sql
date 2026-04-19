-- 202604190004：客户端行为事件 analytics_events 上报基建。
--
-- 设计取舍（KISS）：
-- - 一张平坦表：id / user_id / event / properties / occurred_at / created_at；不做额外维度表。
-- - 区分 occurred_at（客户端事件发生时间）与 created_at（服务端写入时间），便于分析 batch 延迟。
-- - 未登录事件允许上报（user_id 为 null），覆盖启动期、登录前的触点。
-- - 客户端直写关闭：RLS default-deny + 禁止 INSERT 的显式 policy；写入一律走 ingest-analytics Edge Function。
-- - 历史归档走 prune_analytics_events(days)，默认保留 365 天；若 pg_cron 可用则注册每日任务。

create table if not exists public.analytics_events (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  event       text not null,
  properties  jsonb,
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now()
);

comment on table public.analytics_events is
  '客户端行为事件聚合表；写入走 ingest-analytics Edge Function。';

-- 按用户 + 时间倒序查某用户行为轨迹；这是后台运营最常用的查询路径。
create index if not exists analytics_events_user_time_idx
  on public.analytics_events (user_id, occurred_at desc);

-- 按事件名 + 时间倒序做维度聚合，例如"最近 24h 有多少 payment_started"。
create index if not exists analytics_events_event_time_idx
  on public.analytics_events (event, occurred_at desc);

alter table public.analytics_events enable row level security;

-- 用户只能读取自己的行为事件，便于个人数据导出 / 自查。
drop policy if exists analytics_events_select_own_or_admin on public.analytics_events;
create policy analytics_events_select_own_or_admin on public.analytics_events
  for select using (
    user_id = auth.uid() or public.is_admin()
  );

-- 明确禁止客户端 INSERT：所有写路径都由 ingest-analytics Edge Function（service_role）统一执行。
-- 这样可以做 batch 上限、字段长度裁剪，同时避免伪造 user_id。
drop policy if exists analytics_events_no_direct_write on public.analytics_events;
create policy analytics_events_no_direct_write on public.analytics_events
  for insert with check (false);

-- ========== TTL / 归档 ==========
create or replace function public.prune_analytics_events(retention_days int default 365)
returns int
language plpgsql
security definer
set search_path = public
as $analytics_prune_body$
declare
  v_deleted bigint;
begin
  if retention_days is null or retention_days < 1 then
    raise exception 'retention_days 必须为 >=1 的正整数';
  end if;

  delete from public.analytics_events
  where occurred_at < now() - make_interval(days => retention_days);

  get diagnostics v_deleted = row_count;

  return coalesce(v_deleted, 0)::int;
end
$analytics_prune_body$;

comment on function public.prune_analytics_events(int) is
  '删除 N 天前的行为事件；默认保留 365 天。推荐由 pg_cron 每日调用一次。';

revoke execute on function public.prune_analytics_events(int) from public;
revoke execute on function public.prune_analytics_events(int) from anon;
revoke execute on function public.prune_analytics_events(int) from authenticated;

-- ========== pg_cron 调度（手动执行）==========
-- 经验教训：部分 SQL 执行器（含某些版本的 Supabase Web SQL 编辑器复制粘贴路径）
-- 不能正确解析 DO 块的 dollar quote，会把 `select ... into v_xxx` 误判为 SELECT INTO table。
-- 因此本迁移不再在 DO 块里自动注册 cron job；迁移本身只负责创建清理函数。
-- 如项目已启用 pg_cron，请由管理员在 Dashboard → SQL Editor 单独执行以下语句注册任务（与 audit prune 02:30 错峰到 03:15）：
--
--   select cron.schedule(
--     'prune_analytics_events_daily',
--     '15 3 * * *',
--     'select public.prune_analytics_events(365);'
--   );
--
-- 需要取消或重注册时：
--
--   select cron.unschedule('prune_analytics_events_daily');
