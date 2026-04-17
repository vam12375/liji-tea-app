# 售后 / 退款中心 V1 设计稿

日期：2026-04-14

## 1. 目标

本设计稿用于为李记茶 App 增加首个正式售后域，补齐“下单、支付、物流之后，用户遇到问题如何处理”的业务闭环。

本期遵循以下原则：

- KISS：第一期只做最核心的退款链路，不同时引入退货退款、换货和后台审核台。
- YAGNI：不为了未来的工单平台一次性抽象过度。
- SOLID：售后流程使用独立业务域建模，不把复杂状态直接塞进 `orders` 主表。

## 2. 本期范围

### 范围内

- 仅退款 V1
- 整单退款
- 未发货自动通过，其余人工审核
- 用户端申请退款页
- 用户端售后进度页
- 订单 / 物流页售后入口与状态摘要
- 售后状态变化写入站内通知
- 独立售后域表结构
- 售后创建 / 撤销 Edge Function

### 暂不纳入

- 退货退款
- 换货
- 审核后台页面
- 第三方推送通知
- 支付网关原路退款真实对接
- 多次售后申请
- 部分退款 / 按订单项退款

## 3. 业务边界

### 3.1 订单适用规则

- `pending`：不允许走售后，继续沿用现有取消订单流程。
- `paid` 且未发货：允许发起退款申请，自动通过。
- `shipping`：允许发起退款申请，但进入人工审核。
- `delivered`：允许发起退款申请，但进入人工审核。
- `cancelled`：不允许再次发起退款申请。

### 3.2 并发规则

- 一笔订单同一时间只能存在一条进行中的售后申请。
- `submitted`、`auto_approved`、`pending_review`、`approved`、`refunding` 都视为进行中。
- `rejected`、`refunded`、`cancelled` 视为已结束。
- V1 不支持同一订单结束后再次发起第二笔售后。

### 3.3 用户输入

- 退款原因：枚举值必填。
- 问题描述：文本选填，限制长度。
- 凭证图片：最多 3 到 6 张。
- 退款金额：V1 固定整单金额，不允许用户编辑。

## 4. 状态机

### 4.1 售后申请状态

- `submitted`：用户已提交申请。
- `auto_approved`：系统自动审核通过。
- `pending_review`：等待人工审核。
- `approved`：人工审核通过。
- `rejected`：人工审核拒绝。
- `refunding`：退款处理中。
- `refunded`：退款完成。
- `cancelled`：用户主动撤销申请。

### 4.2 推荐流转

#### 未发货自动通过

`submitted -> auto_approved -> refunding -> refunded`

#### 其余人工审核

`submitted -> pending_review -> approved -> refunding -> refunded`

#### 审核拒绝

`submitted -> pending_review -> rejected`

#### 用户撤销

`submitted -> cancelled`

`pending_review -> cancelled`

## 5. 数据模型

### 5.1 新表：`after_sale_requests`

建议字段：

- `id uuid primary key`
- `order_id uuid not null references public.orders(id)`
- `user_id uuid not null references public.profiles(id)`
- `request_type text not null default 'refund'`
- `scope_type text not null default 'order'`
- `status text not null`
- `reason_code text not null`
- `reason_text text`
- `requested_amount numeric(10,2) not null`
- `approved_amount numeric(10,2)`
- `currency text not null default 'CNY'`
- `audit_note text`
- `refund_note text`
- `snapshot jsonb not null default '{}'::jsonb`
- `submitted_at timestamptz not null default timezone('utc', now())`
- `reviewed_at timestamptz`
- `refunded_at timestamptz`
- `cancelled_at timestamptz`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`

约束建议：

- `request_type in ('refund')`
- `scope_type in ('order')`
- `status in ('submitted','auto_approved','pending_review','approved','rejected','refunding','refunded','cancelled')`
- 同一订单最多一条进行中的售后申请，可通过部分唯一索引实现。

### 5.2 新表：`after_sale_evidences`

建议字段：

- `id uuid primary key`
- `request_id uuid not null references public.after_sale_requests(id) on delete cascade`
- `file_url text not null`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default timezone('utc', now())`

### 5.3 订单快照字段

建议在 `orders` 表新增：

- `after_sale_status text`
- `refund_status text`
- `refund_amount numeric(10,2)`
- `refunded_at timestamptz`

说明：

- `orders` 只保留展示和查询摘要，不承载完整售后状态机。
- 订单页、物流页、通知跳转可直接读取这些快照字段，减少高频联表。

### 5.4 通知策略

- 第一阶段继续复用现有 `notifications.type='order'`。
- 使用 `related_type='after_sale_request'` 标记售后通知。
- `metadata` 建议包含：
  - `after_sale_request_id`
  - `order_id`
  - `after_sale_status`
  - `refund_amount`

## 6. 页面设计

### 6.1 退款申请入口

接入点：

- `src/app/tracking.tsx`
- 后续如存在订单详情独立页，也应复用相同入口判定

规则：

- 没有进行中售后且订单满足条件时，显示 `申请退款`
- 已有售后时，显示 `查看售后进度`
- 不符合条件时不展示

### 6.2 新页面：退款申请页

建议路由：

- `src/app/after-sale/apply.tsx`

功能：

- 展示订单号、退款金额、订单商品摘要
- 原因选择
- 问题描述输入
- 凭证图片上传
- 提交申请

### 6.3 新页面：售后进度页

建议路由：

- `src/app/after-sale/[id].tsx`

功能：

- 显示申请编号
- 显示当前状态
- 时间线展示状态节点
- 展示审核备注 / 退款备注
- 审核前允许撤销申请

## 7. 客户端分层

### 7.1 `src/lib/afterSale.ts`

职责：

- 查询我的售后列表
- 查询售后详情
- 创建售后申请
- 撤销售后申请
- 上传售后凭证

### 7.2 `src/stores/afterSaleStore.ts`

职责：

- 持有售后列表
- 持有当前售后详情
- 管理提交中、撤销中状态
- 统一错误提示文案

说明：

- `orderStore` 继续维护订单缓存，不接管完整售后流程。
- 订单页只读 `orders` 的售后快照字段或在需要时跳转售后详情页。

## 8. 服务端接口

### 8.1 Edge Function：`create-after-sale-request`

职责：

- 校验登录态
- 校验订单归属
- 校验订单状态是否允许申请
- 校验是否已有进行中售后
- 生成 `snapshot`
- 写入 `after_sale_requests`
- 写入 `after_sale_evidences`
- 自动判定“未发货自动通过”
- 自动回写订单快照和站内通知

### 8.2 Edge Function：`cancel-after-sale-request`

职责：

- 校验登录态
- 校验申请归属
- 校验是否处于 `submitted / pending_review`
- 更新为 `cancelled`
- 回写订单快照
- 写入站内通知

### 8.3 读取接口

- 我的售后列表：直接查表 + RLS
- 售后详情：直接查表 + RLS

理由：

- 当前仓库对查询型场景已有直接查表模式，继续沿用更简单。
- 把事务性校验集中到 Edge Function，符合现有工程习惯。

## 9. 数据库触发器与策略

### 9.1 建议触发器

- 通用 `updated_at` 触发器
- 售后状态变化 -> 写入 `notifications`
- 售后状态变化 -> 回写 `orders.after_sale_status / refund_status / refund_amount / refunded_at`

### 9.2 RLS 策略

`after_sale_requests`

- 用户可读取自己的申请
- 用户只能创建自己的申请
- 用户只能撤销自己的申请，不允许任意改状态

`after_sale_evidences`

- 用户可读取自己申请下的凭证
- 用户只能写入自己申请下的凭证

## 10. Storage 策略

建议新建目录：

- `after-sale-evidences/{userId}/{requestId}/...`

V1 规则：

- 只支持图片
- 最大 3 到 6 张
- 单张大小限制应与当前项目图片上传规则保持一致

## 11. 通知文案建议

- 申请已提交：`退款申请已提交，请等待系统处理或人工审核。`
- 自动通过：`退款申请已通过，系统正在处理退款。`
- 待人工审核：`退款申请已进入人工审核，请留意后续结果。`
- 审核通过：`退款申请审核通过，退款处理中。`
- 审核拒绝：`退款申请未通过，请查看审核说明。`
- 退款完成：`退款已完成，请注意查收。`
- 用户撤销：`退款申请已撤销。`

## 12. 页面 / Store / 数据库 / 函数 四层实施清单

### 页面

- 在 `tracking.tsx` 增加退款入口与售后状态展示
- 新增退款申请页
- 新增售后进度页
- 在通知跳转逻辑中支持 `after_sale_request`

### Store

- 新增 `afterSaleStore.ts`
- 在 `routes.ts` 中新增售后相关路由构造
- 如有必要，在 `orderStore` 中补读取订单售后快照的辅助方法

### 数据库

- 新建 `after_sale_requests`
- 新建 `after_sale_evidences`
- 为 `orders` 补售后快照字段
- 新增索引、触发器、RLS

### Edge Functions

- 新增 `create-after-sale-request`
- 新增 `cancel-after-sale-request`
- 如有需要，补服务端共享校验函数到 `_shared`

## 13. 验收标准

- 用户能从符合条件的订单发起退款申请
- 未发货订单自动进入通过链路
- 其他申请进入人工审核态
- 售后进度页可查看状态变化
- 订单页和物流页能正确显示售后摘要
- 通知中心能收到售后相关消息

## 14. 后续阶段

本设计完成后，再进入以下后续子项目：

1. 推送通知系统
2. 会员权益兑现 + 积分消费
3. 礼赠闭环

其中推送通知系统建议在售后通知、订单通知稳定后接入，避免同时变更多条消息链路。
