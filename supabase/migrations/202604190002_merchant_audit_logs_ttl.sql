-- 202604190002：商家审计日志 TTL / 归档策略。
--
-- 设计取舍（KISS）：
-- - 不做独立归档表：MVP 规模下一年容量完全够用；真正需要冷库时再加 analytics_events 风格的冷表。
-- - 清理函数独立存在：即使 pg_cron 扩展未启用，管理员也可以在 Dashboard 直接 call；
--   启用了 pg_cron 时本迁移会顺手注册每日定时任务。
-- - 默认 365 天保留：与常见的商户数据审计需求对齐；函数入参支持覆盖，便于临时强清。
-- - 锁死执行权：revoke 掉 anon / authenticated / public，只留 service_role 与 superuser。

create or replace function public.prune_merchant_audit_logs(retention_days int default 365)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  if retention_days is null or retention_days < 1 then
    raise exception 'retention_days 必须为 >=1 的正整数';
  end if;

  delete from public.merchant_audit_logs
  where created_at < now() - make_interval(days => retention_days);

  -- GET DIAGNOSTICS 取上一步 DML 的受影响行数，比 WITH CTE + SELECT INTO 更通用。
  get diagnostics v_deleted = row_count;

  return coalesce(v_deleted, 0)::int;
end;
$$;

comment on function public.prune_merchant_audit_logs(int) is
  '删除 N 天前的商家审计日志；默认保留 365 天。推荐由 pg_cron 每日调用一次。';

-- 关闭默认 PUBLIC 执行权，避免客户端通过 anon / authenticated 直接触发清理。
revoke execute on function public.prune_merchant_audit_logs(int) from public;
revoke execute on function public.prune_merchant_audit_logs(int) from anon;
revoke execute on function public.prune_merchant_audit_logs(int) from authenticated;

-- 若当前项目启用了 pg_cron，则注册每日 02:30 UTC 的定时清理任务；
-- 未启用 pg_cron 的环境静默跳过，避免迁移失败。
do $$
declare
  v_has_cron boolean;
  v_has_job  boolean;
begin
  select exists(select 1 from pg_extension where extname = 'pg_cron') into v_has_cron;
  if not v_has_cron then
    raise notice 'pg_cron 未启用：prune_merchant_audit_logs 需手动调度。';
    return;
  end if;

  -- 同名 job 已存在时先注销，保证幂等：允许本迁移被重放而不重复注册。
  select exists(
    select 1 from cron.job where jobname = 'prune_merchant_audit_logs_daily'
  ) into v_has_job;
  if v_has_job then
    perform cron.unschedule('prune_merchant_audit_logs_daily');
  end if;

  perform cron.schedule(
    'prune_merchant_audit_logs_daily',
    '30 2 * * *',
    $cmd$select public.prune_merchant_audit_logs(365);$cmd$
  );
end $$;
