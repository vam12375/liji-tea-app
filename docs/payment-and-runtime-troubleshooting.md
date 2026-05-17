# 支付链路与运行时排障手册

##目标

本文档用于帮助开发者快速理解并排查以下链路：

- 订单创建
- 支付发起
- 支付状态确认
- 支付回调落库
- 一键登录基础联调前置
- 环境变量与原生能力问题

适用场景：

- 本地开发联调
- Dev Client /Android 原生包调试
- Supabase Edge Functions 故障定位
- 支付异常单排查

---

##一、当前支付链路总览

当前项目的支付链路已经按“前端页面 → 前端服务层 → Edge Functions → SQL 原子函数”分层。

### 1. 前端页面层

- `src/app/checkout.tsx`
- `src/app/payment.tsx`

当前页面本身已经尽量只负责：

-展示 UI
- 接收用户输入
- 调用 Hook
- 跳转页面

### 2. 前端 Hook / 服务层

- `src/hooks/useCheckoutPricing.ts`
- `src/hooks/useCheckoutSubmit.ts`
- `src/hooks/usePaymentScreenState.ts`
- `src/lib/order.ts`
- `src/lib/alipay.ts`
- `src/lib/payment.ts`
- `src/lib/paymentFlow.ts`
- `src/lib/supabaseFunction.ts`

这一层负责：

- 统一调用 Supabase Edge Functions
-统一认证模式与错误解析
- 统一支付 phase 状态推进
- 统一订单询价 / 下单 / 支付确认消费方式

### 3. Edge Functions

- `supabase/functions/create-order`
- `supabase/functions/alipay-create-order`
- `supabase/functions/payment-order-status`
- `supabase/functions/alipay-notify`
- `supabase/functions/mock-payment-confirm`

这一层负责：

-校验用户身份
- 校验订单归属
- 服务端重算价格
- 创建支付单
- 确认支付结果
- 接收支付宝 notify
- 回写订单与支付流水

### 4. SQL /原子边界

关键迁移与函数：

- `202604070001_add_atomic_payment_init.sql`
- `202604080002_add_atomic_mark_order_paid.sql`
- `202604090001_harden_payment_atomic_guards.sql`
- `cancel_pending_order_and_restore_stock`
- `atomic_init_payment`
- `mark_order_paid_atomic`

这一层负责：

- 支付初始化幂等
-支付成功原子落库
- 防止非法状态迁移
- 防止重复支付回写
- 防止 `out_trade_no` / `trade_no` 跨订单污染

---

## 二、推荐排查顺序

出现支付问题时，建议按下面顺序排查，而不是直接盯前端页面：

1. 先看运行环境是否正确
2. 再看前端是否拿到了正确的 `orderId / paymentMethod`
3.再看 Edge Function 返回了什么错误
4. 再看订单表和 `payment_transactions` 是否一致
5. 最后再看支付宝 notify 是否成功到达并验签通过

---

## 三、常见问题与排查方法

### 1. 结算页无法提交订单

优先检查：

-是否已登录
- 是否已选择地址
- 购物项是否为空
- `quote-order` 是否返回成功
- 当前支付渠道是否启用

重点位置：

- `src/hooks/useCheckoutPricing.ts`
- `src/hooks/useCheckoutSubmit.ts`
- `src/lib/order.ts`
- `supabase/functions/quote-order`
- `supabase/functions/create-order`

典型现象：

- 页面提示“暂无可结算商品”
- 页面提示“订单金额正在由服务端计算”
-页面提示“创建订单失败”

建议动作：

- 看控制台日志中的 `supabase-function` 输出
-检查 `create-order` 的 HTTP 返回体里的 `message / code`
- 确认商品、库存、地址、优惠券数据都合法

### 2. 支付按钮可见，但无法发起支付

优先检查：

- 是否处于 Android 环境
- 是否使用 Dev Client / 原生构建
- 支付宝 AAR 是否已放入 `modules/liji-alipay/android/libs/`
- `EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED` 是否为 `true`
- `alipay-create-order` 是否已成功返回 `orderString`

重点位置：

- `src/app/payment.tsx`
- `src/hooks/usePaymentScreenState.ts`
- `src/lib/alipayNative.ts`
- `src/lib/paymentFlow.ts`
- `supabase/functions/alipay-create-order`

### 3.SDK 返回成功，但页面没有进入支付成功态

这是支付链路里最常见的误区。

当前项目的正确口径不是“SDK 成功 = 订单已支付”，而是：

-SDK 返回成功后
- 还要等待服务端确认
- 最终以 `payment-order-status` / `alipay-notify` 回写结果为准

优先检查：

- `payment-order-status` 是否返回 `status = paid`
- `paymentStatus` 是否为 `success`
- `alipay-notify` 是否实际收到回调
- `notify_verified` 是否为 `true`
- `orders.payment_status` 与 `payment_transactions.status` 是否一致

重点位置：

- `src/lib/paymentFlow.ts`
- `src/lib/alipay.ts`
- `supabase/functions/payment-order-status`
- `supabase/functions/alipay-notify`
- `payment_transactions` 表

### 4.支付宝回调到了，但订单被标记成失败

当前项目已经对异常 notify 做了显式标记。

典型失败原因：

- 金额不一致：`amount_mismatch`
- 订单已取消却收到成功回调：`abnormal_paid_notify`
- 订单状态不是 `pending`，却收到成功支付回写

重点检查字段：

- `orders.payment_error_code`
- `orders.payment_error_message`
- `orders.status`
- `orders.payment_status`
- `payment_transactions.notify_payload`
- `payment_transactions.notify_verified`

### 5. 同一笔支付被重复回写

当前已经加固：

- `orders.out_trade_no`唯一索引
- `payment_transactions.out_trade_no` 唯一约束
- `payment_transactions.trade_no` 唯一索引
- `mark_order_paid_atomic` 的已支付幂等返回
- `atomic_init_payment` / `mark_order_paid_atomic` 的非法状态拦截

如果怀疑重复支付或重复 notify：

- 先查 `out_trade_no`
- 再查 `trade_no`
- 再看订单是否已经是 `paid + success`

### 6.待支付订单超过 10 分钟后行为异常

当前项目中，超时待支付订单会进入关闭流程。

相关逻辑：

- `src/lib/orderTiming.ts`
- `supabase/functions/_shared/payment.ts`
- `closeExpiredPendingOrder()`
- `cancel_pending_order_and_restore_stock`

预期结果：

-订单状态变为 `cancelled`
- `payment_status = closed`
- `payment_error_code = order_expired`
-预留库存释放
- 已锁定优惠券释放
- 如存在支付宝支付单，服务端尝试关单

---

## 四、关键数据表排查建议

### 1. orders

重点看这些字段：

- `status`
- `payment_channel`
- `payment_status`
- `out_trade_no`
- `trade_no`
- `paid_amount`
- `paid_at`
- `payment_error_code`
- `payment_error_message`

### 2. payment_transactions

重点看这些字段：

- `order_id`
- `channel`
- `out_trade_no`
- `trade_no`
- `amount`
- `status`
- `request_payload`
- `notify_payload`
- `notify_verified`
- `updated_at`

### 3.user_coupons / coupons

如果订单使用了优惠券，还应检查：

- `user_coupons.status`
- `user_coupons.order_id`
- `user_coupons.used_at`
- `coupons.used_count`

### 4.order_tracking_events

支付成功后如果物流轨迹没有生成，重点检查：

- `mark_order_paid_atomic` 是否执行成功
- `order_tracking_events` 是否插入成功

---

## 五、环境变量清单

### 1.前端客户端变量

必须项：

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

常用开关：

- `EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED`
- `EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED`
- `EXPO_PUBLIC_PAYMENT_ENV`
- `EXPO_PUBLIC_WEB_URL`
- `EXPO_PUBLIC_ALI_TEMPLATE_ID`

### 2. Edge Functions / 服务端变量

支付链路关键项：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- `ALIPAY_GATEWAY`
- `ALIPAY_NOTIFY_URL`
- `ALIPAY_SELLER_ID`

一键登录关键项：

- `ALI_APP_KEY`

### 3. 注意事项

- `SUPABASE_SERVICE_ROLE_KEY`只能在服务端保存
- 支付宝私钥只能放在服务端
- 不要把任何私钥、服务角色密钥提交进仓库

---

##六、一键登录排查简表

虽然本轮重点是支付，但一键登录也建议统一按下面顺序排查：

1. 当前是否为 Android Dev Client / 原生包
2. 原生模块是否已打进安装包
3. `ALI_APP_KEY` 是否正确
4. `EXPO_PUBLIC_ALI_TEMPLATE_ID`是否正确
5. `supabase/functions/ali-login` 是否能访问
6. Supabase session 是否成功写入

重点位置：

- `src/hooks/useOneClickLogin.ts`
- `src/modules/ali-one-login.ts`
- `modules/ali-one-login/`
- `supabase/functions/ali-login`

---

##七、建议的联调命令

前端校验：

```bash
npm run typecheck
npm run lint
npm run test
```

如需完整检查：

```bash
npm run check
```

函数类型校验：

```bash
npm run typecheck:functions
npm run typecheck:all
```

---

##八、建议的发布前最小核对清单

### 支付

- [ ] `create-order` 正常创建订单
- [ ] `alipay-create-order` 能返回合法支付单
- [ ] `payment-order-status` 能正确返回服务端口径
- [ ] `alipay-notify` 能成功验签并回写
- [ ] 重复 notify 不会破坏已支付状态
- [ ]超时订单能自动关闭并释放库存/优惠券
- [ ] 异常单会写入错误码与错误信息

### 登录

- [ ] 普通登录会话恢复正常
- [ ]一键登录能在真机 / Dev Client 中完成
- [ ] 失效 session 能被正确识别并刷新或跳登录

### 文档与配置

- [ ]`.env.example` 与实际使用变量一致
- [ ] README 中的联调说明与当前实现一致
- [ ] 迁移、函数、前端支付入口说明保持同步

---

##九、当前项目建议

当前项目已经从“能跑”进入“高风险链路需要稳定治理”的阶段。

建议后续持续执行三件事：

1. 所有支付状态迁移尽量只通过 SQL 原子函数完成
2. 所有 Edge Function 错误统一输出 `message + code`
3. 新增支付相关改动时，优先补测试，再改页面
