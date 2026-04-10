-- 取消订单已改为前端调用 Edge Function，再由服务端使用 service_role 调用 RPC。
-- 因此这里回收 authenticated 对关单 RPC 的直接执行权限，统一前后端权限模型。

revoke execute on function public.cancel_pending_order_and_restore_stock(uuid, uuid, text, text, text)
  from authenticated;

grant execute on function public.cancel_pending_order_and_restore_stock(uuid, uuid, text, text, text)
 to service_role;

comment on function public.cancel_pending_order_and_restore_stock(uuid, uuid, text, text, text) is
'关闭待支付订单并释放已占用库存；仅允许 service_role 调用，供服务端自动关单与取消订单 Edge Function 使用。';
