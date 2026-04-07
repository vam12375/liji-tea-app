-- 收紧订单、支付流水、物流轨迹与用户券的前端访问边界。
-- 目标：
-- 1. 只允许登录用户读取自己的订单域数据
-- 2. 禁止客户端直接对订单/支付相关表做 insert/update/delete
-- 3. 支付成功、失败、关闭仅允许服务端函数或数据库受控过程写入

-- 先为订单域相关表统一开启 RLS，后续所有前端访问都必须命中显式策略。
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.order_tracking_events enable row level security;
alter table public.user_coupons enable row level security;

-- 订单主表：只允许登录用户读取自己名下订单。
drop policy if exists "Users view own orders" on public.orders;
create policy "Users view own orders"
on public.orders for select
to authenticated
using (auth.uid() = user_id);

-- 订单明细表：通过关联订单归属限制，只允许读取自己订单下的商品明细。
drop policy if exists "Users view own order items" on public.order_items;
create policy "Users view own order items"
on public.order_items for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

-- 支付流水表：仅允许用户查看自己的支付记录，避免枚举或窥探他人交易信息。
drop policy if exists "Users view own payment transactions" on public.payment_transactions;
create policy "Users view own payment transactions"
on public.payment_transactions for select
to authenticated
using (auth.uid() = user_id);

-- 物流轨迹表：仅暴露本人订单的物流事件，防止越权读取配送进度。
drop policy if exists "Users view own order tracking events" on public.order_tracking_events;
create policy "Users view own order tracking events"
on public.order_tracking_events for select
to authenticated
using (auth.uid() = user_id);

-- 用户券表：只允许用户查看自己的领券/锁券/用券记录。
drop policy if exists "Users view own user coupons" on public.user_coupons;
create policy "Users view own user coupons"
on public.user_coupons for select
to authenticated
using (auth.uid() = user_id);

-- 不给匿名与普通登录客户端任何直接写权限。
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.payment_transactions from anon, authenticated;
revoke insert, update, delete on public.order_tracking_events from anon, authenticated;
revoke insert, update, delete on public.user_coupons from anon, authenticated;

-- 回收历史客户端可调用的订单关闭 RPC，只保留 service_role 执行，避免前端直接触发库存释放与订单关闭。
revoke execute on function public.cancel_pending_order_and_restore_stock(uuid, uuid, text, text, text)
  from authenticated;
grant execute on function public.cancel_pending_order_and_restore_stock(uuid, uuid, text, text, text)
  to service_role;

-- 为策略补充中文注释，便于后续在数据库侧审计访问边界。
comment on policy "Users view own orders" on public.orders is '仅允许登录用户读取自己的订单。';
comment on policy "Users view own order items" on public.order_items is '仅允许登录用户读取自己订单下的订单明细。';
comment on policy "Users view own payment transactions" on public.payment_transactions is '仅允许登录用户读取自己的支付流水。';
comment on policy "Users view own order tracking events" on public.order_tracking_events is '仅允许登录用户读取自己订单的物流轨迹。';
comment on policy "Users view own user coupons" on public.user_coupons is '仅允许登录用户读取自己的用户券记录。';
