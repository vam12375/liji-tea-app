-- 202604190003：Edge Function 限流基建（固定窗口计数）。
--
-- 设计取舍（KISS）：
-- - 固定窗口计数（fixed window）：一行一个 (user, bucket, window_start)，累加值超过 max 即拒绝；
--   比 sliding window / leaky bucket 粗糙但足以挡刷单 / 连点连刷请求。
-- - window_start 按 epoch 截断到 p_window_sec 的整数倍，保证同一窗口内的请求共享同一行。
-- - Edge Function 仅通过 `consume_rate_limit(p_user_id, ...)` RPC 递增，禁止任何客户端直接 insert / update。
-- - 24 小时外的窗口交由 `prune_rate_limit_buckets()` 回收；若 pg_cron 可用则每小时注册一次。

create table if not exists public.rate_limit_buckets (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  bucket       text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (user_id, bucket, window_start)
);

comment on table public.rate_limit_buckets is
  '固定窗口限流计数表：一行 = 一个 (user, bucket, window_start) 组合的累计命中数。';

-- 按 window_start 单独建索引，便于 prune 按时间扫删。
create index if not exists rate_limit_buckets_window_start_idx
  on public.rate_limit_buckets (window_start);

-- 启用 RLS 但不赋任何策略：默认拒绝所有客户端读写；service_role 天然绕过。
alter table public.rate_limit_buckets enable row level security;

-- ========== 消费限流 RPC ==========
create or replace function public.consume_rate_limit(
  p_user_id    uuid,
  p_bucket     text,
  p_max        int,
  p_window_sec int
)
returns table (allowed boolean, retry_after_sec int)
language plpgsql
security definer
set search_path = public
as $rl_consume_body$
declare
  v_window_start timestamptz;
  v_count        int;
begin
  if p_user_id is null or p_bucket is null or p_max < 1 or p_window_sec < 1 then
    allowed := false;
    retry_after_sec := coalesce(p_window_sec, 60);
    return next;
    return;
  end if;

  -- 对齐到固定窗口起点：epoch 秒截断成 p_window_sec 的倍数，再转回 timestamptz。
  v_window_start := to_timestamp(
    (extract(epoch from now())::bigint / p_window_sec) * p_window_sec
  );

  -- 原子 upsert + 计数：同一窗口内重复命中直接自增。
  insert into public.rate_limit_buckets(user_id, bucket, window_start, count)
  values (p_user_id, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = public.rate_limit_buckets.count + 1
  returning count into v_count;

  if v_count <= p_max then
    allowed := true;
    retry_after_sec := 0;
  else
    allowed := false;
    -- 建议客户端等到当前窗口结束；最少 1 秒，避免立刻重试打爆。
    retry_after_sec := greatest(
      1,
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_sec)) - now()))::int
    );
  end if;
  return next;
end
$rl_consume_body$;

comment on function public.consume_rate_limit(uuid, text, int, int) is
  '递增 (user, bucket) 的固定窗口命中；返回 allowed 与建议 retry_after_sec。';

revoke execute on function public.consume_rate_limit(uuid, text, int, int) from public;
revoke execute on function public.consume_rate_limit(uuid, text, int, int) from anon;
revoke execute on function public.consume_rate_limit(uuid, text, int, int) from authenticated;

-- ========== 过期窗口清理 ==========
create or replace function public.prune_rate_limit_buckets()
returns int
language plpgsql
security definer
set search_path = public
as $rl_prune_body$
declare
  v_deleted bigint;
begin
  delete from public.rate_limit_buckets
  where window_start < now() - interval '24 hours';

  get diagnostics v_deleted = row_count;

  return coalesce(v_deleted, 0)::int;
end
$rl_prune_body$;

comment on function public.prune_rate_limit_buckets() is
  '删除 24 小时前的限流窗口记录；建议每小时调度清理。';

revoke execute on function public.prune_rate_limit_buckets() from public;
revoke execute on function public.prune_rate_limit_buckets() from anon;
revoke execute on function public.prune_rate_limit_buckets() from authenticated;

-- ========== pg_cron 调度（手动执行）==========
-- 经验教训：部分 SQL 执行器（含某些版本的 Supabase Web SQL 编辑器复制粘贴路径）
-- 不能正确解析 DO 块的 dollar quote，会把 `select ... into v_xxx` 误判为 SELECT INTO table。
-- 因此本迁移不再在 DO 块里自动注册 cron job；迁移本身只负责创建清理函数。
-- 如项目已启用 pg_cron，请由管理员在 Dashboard → SQL Editor 单独执行以下语句注册任务：
--
--   select cron.schedule(
--     'prune_rate_limit_buckets_hourly',
--     '15 * * * *',
--     'select public.prune_rate_limit_buckets();'
--   );
--
-- 需要取消或重注册时：
--
--   select cron.unschedule('prune_rate_limit_buckets_hourly');
