-- 202604190005：匿名限流基建（固定窗口计数）。
--
-- 背景：202604190003 的 rate_limit_buckets 通过 user_id 外键到 auth.users(id)，
-- 只能给登录后接口限流；ali-login / report-crash 等需要在登录前 / 匿名侧生效。
--
-- 设计取舍（KISS）：
-- - 结构与 rate_limit_buckets 完全对齐（固定窗口 + 原子 upsert + 自增计数），
--   仅把 user_id 主键替换为 bucket_key text（允许 IP hash / phone hash / device id 等）。
-- - 禁止客户端直接访问：启用 RLS 但不给任何策略，只有 service_role 能写读。
-- - 调用方自行负责不把明文 IP / 手机号写入 bucket_key，避免 PII 落库。

create table if not exists public.anon_rate_limit_buckets (
  bucket_key   text        not null,
  bucket       text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (bucket_key, bucket, window_start)
);

comment on table public.anon_rate_limit_buckets is
  '匿名维度固定窗口限流计数表：bucket_key 可为 IP hash / device id 等（调用方自行 hash）。';

-- 按 window_start 单独建索引，便于 prune 按时间扫删。
create index if not exists anon_rate_limit_buckets_window_start_idx
  on public.anon_rate_limit_buckets (window_start);

-- 启用 RLS 但不赋任何策略：默认拒绝所有客户端读写；service_role 天然绕过。
alter table public.anon_rate_limit_buckets enable row level security;

-- ========== 消费匿名限流 RPC ==========
create or replace function public.consume_anon_rate_limit(
  p_bucket_key text,
  p_bucket     text,
  p_max        int,
  p_window_sec int
)
returns table (allowed boolean, retry_after_sec int)
language plpgsql
security definer
set search_path = public
as $anon_rl_consume_body$
declare
  v_window_start timestamptz;
  v_count        int;
begin
  if p_bucket_key is null or p_bucket is null or p_max < 1 or p_window_sec < 1 then
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
  insert into public.anon_rate_limit_buckets(bucket_key, bucket, window_start, count)
  values (p_bucket_key, p_bucket, v_window_start, 1)
  on conflict (bucket_key, bucket, window_start)
  do update set count = public.anon_rate_limit_buckets.count + 1
  returning count into v_count;

  if v_count <= p_max then
    allowed := true;
    retry_after_sec := 0;
  else
    allowed := false;
    retry_after_sec := greatest(
      1,
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_sec)) - now()))::int
    );
  end if;
  return next;
end
$anon_rl_consume_body$;

comment on function public.consume_anon_rate_limit(text, text, int, int) is
  '递增 (bucket_key, bucket) 的固定窗口命中；返回 allowed 与建议 retry_after_sec。';

revoke execute on function public.consume_anon_rate_limit(text, text, int, int) from public;
revoke execute on function public.consume_anon_rate_limit(text, text, int, int) from anon;
revoke execute on function public.consume_anon_rate_limit(text, text, int, int) from authenticated;

-- ========== 过期窗口清理 ==========
create or replace function public.prune_anon_rate_limit_buckets()
returns int
language plpgsql
security definer
set search_path = public
as $anon_rl_prune_body$
declare
  v_deleted bigint;
begin
  delete from public.anon_rate_limit_buckets
  where window_start < now() - interval '24 hours';

  get diagnostics v_deleted = row_count;

  return coalesce(v_deleted, 0)::int;
end
$anon_rl_prune_body$;

comment on function public.prune_anon_rate_limit_buckets() is
  '删除 24 小时前的匿名限流窗口记录；建议每小时调度清理。';

revoke execute on function public.prune_anon_rate_limit_buckets() from public;
revoke execute on function public.prune_anon_rate_limit_buckets() from anon;
revoke execute on function public.prune_anon_rate_limit_buckets() from authenticated;

-- ========== pg_cron 调度（手动执行）==========
-- 与 202604190003 保持一致：迁移本身不注册 cron job，避免 SQL 执行器对 DO 块的解析差异；
-- 管理员需在 Dashboard → SQL Editor 单独执行：
--
--   select cron.schedule(
--     'prune_anon_rate_limit_buckets_hourly',
--     '20 * * * *',
--     'select public.prune_anon_rate_limit_buckets();'
--   );
