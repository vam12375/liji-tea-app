-- 202604190006：商家工作台聚合 RPC。
--
-- 目标：替换原 merchant/index.tsx 的 Redirect，提供一个页面级聚合接口，
-- 一次返回今日订单数 / 今日 GMV / 待发货 / 待售后 + Top-5 低库存商品，
-- 避免客户端拼接 4~5 次独立查询。
--
-- 设计取舍（KISS / YAGNI）：
-- - 只返回"首屏一眼能看到的 KPI"，7 日趋势 / 同环比等延后到业务需要时再加。
-- - 所有聚合都是有索引可靠的单表查询，控制单次 RPC 在 <100ms；
--   不引入物化视图，避免刷新逻辑与一致性复杂度。
-- - 读取型 RPC，无需写审计。
-- - 低库存阈值 10 作为默认值，可由管理员在未来的运营参数表里覆写；
--   当前按常量写死，避免 YAGNI 过早引入参数表。

create or replace function public.merchant_dashboard_overview()
returns table (
  today_order_count        int,
  today_gmv                numeric,
  pending_ship_count       int,
  pending_after_sale_count int,
  low_stock_products       jsonb
)
language plpgsql
security definer
set search_path = public
as $merchant_dashboard_body$
declare
  v_today_start timestamptz;
  v_low_stock_threshold int := 10;
  v_low_stock_limit     int := 5;
begin
  -- 权限校验：仅允许 admin / staff 进入，和其它 merchant_*() RPC 保持一致。
  if not public.is_merchant_staff() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  v_today_start := date_trunc('day', now());

  select coalesce(count(*), 0)::int,
         coalesce(sum(o.total), 0)::numeric
    into today_order_count, today_gmv
    from public.orders o
   where o.created_at >= v_today_start
     and o.status <> 'cancelled';

  select coalesce(count(*), 0)::int
    into pending_ship_count
    from public.orders o
   where o.status = 'paid'
     and o.shipped_at is null;

  select coalesce(count(*), 0)::int
    into pending_after_sale_count
    from public.after_sale_requests r
   where r.status in ('submitted', 'pending_review');

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', sub.id,
               'name', sub.name,
               'stock', sub.stock
             )
             order by sub.stock asc, sub.name asc
           ),
           '[]'::jsonb
         )
    into low_stock_products
    from (
      select p.id, p.name, p.stock
        from public.products p
       where p.is_active = true
         and p.stock is not null
         and p.stock < v_low_stock_threshold
       order by p.stock asc, p.name asc
       limit v_low_stock_limit
    ) sub;

  return next;
end
$merchant_dashboard_body$;

comment on function public.merchant_dashboard_overview() is
  '商家端工作台聚合：今日订单数 / GMV + 待发货 + 待处理售后 + Top-5 低库存商品。';

-- 与其他 merchant_*() 一致：禁止客户端直接调用，只能通过 authenticated 角色经由
-- RLS + is_merchant_staff() 校验后进入；此处同样回收 public / anon 执行权限。
revoke execute on function public.merchant_dashboard_overview() from public;
revoke execute on function public.merchant_dashboard_overview() from anon;
-- authenticated 保留执行权，便于前端通过 supabase.rpc() 调用；
-- 函数内部 is_merchant_staff() 会拦截非员工用户并抛 permission_denied。
