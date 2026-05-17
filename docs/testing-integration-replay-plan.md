# 集成测试与支付回放测试方案

本方案用于补齐真实风险更高的链路：Supabase RLS、Edge Function、数据库 RPC、库存并发预留、支付宝异步通知幂等，以及订单取消/过期/优惠券释放端到端流程。

> 说明：这些用例依赖本地 Supabase、迁移后的数据库、测试用户与支付回放密钥，不放入默认 `npm run check`，避免普通提交在缺少 Docker、Supabase CLI 或支付密钥时失败。默认质量门禁仍由 `npm run check` 负责；本方案通过 `npm run test:integration:plan` 暴露执行入口。

## 0. 前置条件

1. 安装并登录 Supabase CLI。
2. 本机 Docker 可用。
3. 准备测试环境变量：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALIPAY_APP_ID`
   - `ALIPAY_PUBLIC_KEY`
   - `ALIPAY_PRIVATE_KEY`
   - `ALIPAY_NOTIFY_URL`
4. 使用独立的本地或测试项目，禁止指向生产数据库。

建议执行顺序：

```bash
npx supabase start
npx supabase db reset
npm run typecheck:functions
npm run test:integration:plan
```

## 1. RLS 越权测试

目标：迁移后确认普通用户只能访问自己的资源，商家/服务端角色才具备必要的后台能力。

建议用例：

1. 创建 `user_a`、`user_b`、`merchant_a` 三类测试身份。
2. 使用 `user_a` JWT 读取/更新 `profiles`、`user_addresses`、`user_favorites`、`orders`、`order_items`、`user_coupons`。
3. 断言：
   - 可以读取/更新 `user_a` 自己的数据。
   - 不能读取/更新 `user_b` 的地址、订单、用户券和收藏。
   - 不能直接写入支付状态、订单金额、库存等服务端字段。
4. 使用 `merchant_a` 身份验证商家域最小可见性。
5. 使用 `service_role` 仅验证 Edge Function/RPC 的服务端路径，不将该 Key 暴露给客户端测试。

推荐断言表：

| 资源 | 用户 A 访问自己 | 用户 A 访问用户 B | 匿名访问 | service_role |
| --- | --- | --- | --- | --- |
| `profiles` | 允许 | 拒绝 | 拒绝 | 允许 |
| `user_addresses` | 允许 | 拒绝 | 拒绝 | 允许 |
| `orders` | 允许 | 拒绝 | 拒绝 | 允许 |
| `order_items` | 允许 | 拒绝 | 拒绝 | 允许 |
| `user_coupons` | 允许 | 拒绝 | 拒绝 | 允许 |

## 2. 下单并发库存预留测试

目标：验证 `create_order_with_reserved_stock` 在高并发下不会超卖，且失败请求不会残留异常订单或负库存。

建议流程：

1. 重置数据库并插入一个库存为 `1` 或 `2` 的测试商品。
2. 创建有效地址和登录用户。
3. 并发发起 20 个 `create-order` 请求，请求体使用同一商品。
4. 断言：
   - 成功订单数小于等于初始库存。
   - 商品库存不小于 0。
   - 失败请求返回 `create_order_with_reserved_stock_failed` 或等价库存不足错误。
   - 成功订单的 `order_items.quantity` 总和等于扣减库存。
5. 重复执行 3 次，排除偶发竞争条件。

## 3. 支付宝 notify 回放测试

目标：验证 `supabase/functions/alipay-notify/index.ts` 对签名、金额、订单状态和重复通知的处理稳定且幂等。

建议准备 `fixtures/alipay-notify/*.form` 作为 `application/x-www-form-urlencoded` 回放样本，并保留签名生成脚本或沙箱导出的原始通知。

必须覆盖：

1. **合法支付成功通知**：签名正确、`trade_status=TRADE_SUCCESS`、金额与订单一致，断言返回 `success`，订单只从待支付变为已支付一次。
2. **验签失败通知**：篡改任一字段或签名，断言返回 `failure`，订单状态不变。
3. **金额不一致通知**：签名正确但 `total_amount` 与订单金额不一致，断言返回 `failure` 或进入异常保护分支，订单不标记为已支付。
4. **重复通知**：对已支付订单重复回放同一通知，断言返回 `success`，支付流水/物流初始化/积分发放不重复。
5. **异常订单已支付通知**：订单不存在、订单关闭、订单归属异常或订单号不匹配时，断言不产生越权写入。

建议执行命令形态：

```bash
curl -X POST "$SUPABASE_FUNCTIONS_URL/alipay-notify" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-binary @fixtures/alipay-notify/trade-success.form
```

## 4. 取消、过期关单与优惠券释放端到端测试

目标：覆盖用户主动取消、待支付订单超时关闭、优惠券锁定释放、库存恢复的一致性。

建议流程：

1. 创建带优惠券的待支付订单。
2. 断言用户券状态为 `locked`，订单占用库存。
3. 调用 `cancel-order`。
4. 断言：
   - 订单支付状态变为 `closed`。
   - 库存恢复。
   - 用户券回到 `available`。
5. 再创建一笔待支付订单，将 `payment_expires_at` 调整到过去。
6. 调用支付状态查询或过期关单任务。
7. 断言过期关单与主动取消具备同样的库存/优惠券释放效果。

## 5. 后续自动化落地建议

1. 将上述流程拆成 `tests/integration/*.test.ts`，通过环境变量显式开启，例如 `RUN_INTEGRATION=1`。
2. 将支付宝回放样本放入 `tests/fixtures/alipay-notify/`，并以脱敏测试密钥生成签名。
3. 在 CI 中新增手动触发 workflow，使用一次性 Supabase 测试项目或本地容器执行。
4. 默认 PR 仍只运行 `npm run check`；合并前或发布前再运行集成/回放套件。
