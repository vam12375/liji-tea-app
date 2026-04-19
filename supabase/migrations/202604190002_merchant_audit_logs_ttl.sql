-- 202604190002：商家审计日志 TTL / 归档策略。
--
-- 设计取舍（KISS）：
-- - 不做独立归档表：MVP 规模下一年容量完全够用；真正需要冷库时再加 analytics_events 风格的冷表。
-- - 清理函数独立存在：管理员可在 Dashboard 直接 call，pg_cron 可用时再由管理员手动注册每日任务。
-- - 默认 365 天保留：与常见的商户数据审计需求对齐；函数入参支持覆盖，便于临时强清。
-- - 锁死执行权：revoke 掉 anon / authenticated / public，只留 service_role 与 superuser。

create or replace function public.prune_merchant_audit_logs(retention_days int default 365)
returns int
language plpgsql
security definer
set search_path = public
as $audit_prune_body$
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
end
$audit_prune_body$;

comment on function public.prune_merchant_audit_logs(int) is
  '删除 N 天前的商家审计日志；默认保留 365 天。推荐由 pg_cron 每日调用一次。';

-- 关闭默认 PUBLIC 执行权，避免客户端通过 anon / authenticated 直接触发清理。
revoke execute on function public.prune_merchant_audit_logs(int) from public;
revoke execute on function public.prune_merchant_audit_logs(int) from anon;
revoke execute on function public.prune_merchant_audit_logs(int) from authenticated;

-- ========== pg_cron 调度（手动执行）==========
-- 经验教训：部分 SQL 执行器（含 Supabase Web SQL 编辑器的复制粘贴路径）不能正确解析 DO 块的 dollar quote，
-- 会把 `select ... into v_xxx` 误判为 SELECT INTO table（42P01 relation ... does not exist）。
-- 因此本迁移不在 DO 块里自动注册 cron job；迁移本身只负责创建清理函数。
-- 如项目已启用 pg_cron，请由管理员在 Dashboard → SQL Editor 单独执行以下语句注册任务：
--
--   select cron.schedule(
--     'prune_merchant_audit_logs_daily',
--     '30 2 * * *',
--     'select public.prune_merchant_audit_logs(365);'
--   );
--
-- 需要取消或重注册时：
--
--   select cron.unschedule('prune_merchant_audit_logs_daily');
