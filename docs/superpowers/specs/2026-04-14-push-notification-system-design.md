# 推送通知系统 V1 设计稿

日期：2026-04-14

## 1. 目标

本设计稿用于为李记茶 App 增加首个正式可用的推送通知系统，补齐“站内消息存在，但用户离线时无法被召回”的能力缺口。

本期设计遵循以下原则：

- KISS：先把 Android 真机推送跑通，不同时强行覆盖 iOS 完整联调。
- YAGNI：不在 V1 引入多供应商推送、营销后台和复杂频控。
- SOLID：业务域继续只负责写站内通知，推送投递独立建模，不把投递细节污染 `notifications` 主表。

## 2. 参考依据

根据 Expo SDK 55 官方文档，推送能力的推荐基础链路包括：

- `expo-notifications`
- `expo-device`
- `expo-constants`
- Android notification channel 初始化
- 权限申请
- `getExpoPushTokenAsync({ projectId })`
- 通知接收与点击监听

说明：

- 本设计以 Expo Push Service 作为 V1 的发送通道。
- Android 真机或 Dev Client 是 V1 的验证前提。
- Expo Go 不作为 V1 的正式验证方式。

## 3. 本期范围

### 范围内

- Android 推送真正可用
- iOS 代码预留，不承诺首期联调完成
- Expo Push Service
- 交易类推送
  - 订单状态变化
  - 售后状态变化
- 社区互动推送
  - 帖子评论
  - 点赞 / 收藏等已进入站内消息体系的互动事件
- 设备 token 注册 / 刷新 / 注销
- 设置页真实通知偏好
- 点击推送后的页面跳转
- 推送队列、发送日志与失败记录

### 暂不纳入

- iOS 真机推送联调
- 富媒体推送
- 批量营销活动后台
- 多供应商切换（如直接 FCM）
- 高级频控与去重系统
- 推送回执二次追踪

## 4. 总体架构

### 4.1 核心思路

继续把现有 `notifications` 表作为消息真相源。

推送系统不直接插进订单、售后、社区这些业务域里，而是采用以下链路：

`业务事件 -> notifications -> push_dispatch_queue -> Expo Push Service -> push_delivery_logs`

### 4.2 为什么选择通知驱动 + Push Outbox

当前项目已经存在：

- 站内消息中心
- `notifications` 表
- 数据库触发器写通知
- 订单和售后域通知

如果采用“业务域直接发 Push”的方式，会出现两个问题：

1. 推送逻辑散落在多个业务函数里。
2. 数据库触发器写入的通知无法自然复用同一发送路径。

因此 V1 更适合采用独立的 Push Outbox：

- 业务域只写通知
- 推送层只管投递
- 后续失败重试、用户偏好、发送日志都能在统一边界里处理

## 5. 数据模型

### 5.1 新表：`push_devices`

用途：保存用户设备与 Expo push token。

建议字段：

- `id uuid primary key`
- `user_id uuid not null references public.profiles(id)`
- `platform text not null`
- `expo_push_token text not null`
- `device_name text`
- `app_version text`
- `is_active boolean not null default true`
- `last_seen_at timestamptz`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`

索引建议：

- `(user_id, is_active)`
- `expo_push_token` 唯一索引

### 5.2 新表：`push_preferences`

用途：保存真实通知偏好。

建议字段：

- `user_id uuid primary key references public.profiles(id)`
- `push_enabled boolean not null default true`
- `order_enabled boolean not null default true`
- `after_sale_enabled boolean not null default true`
- `community_enabled boolean not null default true`
- `quiet_hours_start time`
- `quiet_hours_end time`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`

说明：

- V1 可先保存静音时间字段但不启用逻辑。
- 设置页开关从本地状态升级为读写该表。

### 5.3 新表：`push_dispatch_queue`

用途：Push Outbox，保存待投递任务。

建议字段：

- `id uuid primary key`
- `notification_id uuid not null references public.notifications(id) on delete cascade`
- `user_id uuid not null references public.profiles(id) on delete cascade`
- `push_type text not null`
- `payload jsonb not null default '{}'::jsonb`
- `status text not null default 'pending'`
- `attempt_count integer not null default 0`
- `last_error text`
- `scheduled_at timestamptz not null default timezone('utc', now())`
- `processed_at timestamptz`
- `created_at timestamptz not null default timezone('utc', now())`
- `updated_at timestamptz not null default timezone('utc', now())`

状态建议：

- `pending`
- `processing`
- `sent`
- `failed`
- `skipped`

### 5.4 新表：`push_delivery_logs`

用途：记录实际发送到设备的结果。

建议字段：

- `id uuid primary key`
- `queue_id uuid not null references public.push_dispatch_queue(id) on delete cascade`
- `device_id uuid not null references public.push_devices(id) on delete cascade`
- `expo_push_token text not null`
- `ticket_id text`
- `status text not null`
- `error_code text`
- `error_message text`
- `created_at timestamptz not null default timezone('utc', now())`

说明：

- 一个通知任务可能发往多个设备，因此发送日志必须独立建表。
- 不建议把多设备结果直接塞进 `notifications` 或 `push_dispatch_queue`。

## 6. 推送事件流

### 6.1 写入阶段

1. 订单 / 售后 / 社区等业务域继续写 `notifications`
2. 数据库触发器判断该通知是否属于可推送类型
3. 若可推送，则写入 `push_dispatch_queue`

### 6.2 分发阶段

1. `dispatch-push-queue` Edge Function 读取 `pending` 队列
2. 根据 `user_id` 查询：
   - 活跃设备
   - 通知偏好
3. 若用户关闭总开关或对应分类开关：
   - 队列置为 `skipped`
4. 若存在活跃设备：
   - 组装 Expo Push payload
   - 调用 Expo Push Service
   - 写 `push_delivery_logs`
   - 更新队列状态为 `sent` 或 `failed`

### 6.3 点击跳转

推送 `data` 中至少包含：

- `relatedType`
- `relatedId`
- `notificationId`

客户端收到点击事件后复用现有路由跳转：

- `order` -> `tracking`
- `after_sale_request` -> `afterSaleDetail`
- `post` -> 帖子详情

## 7. 客户端设计

### 7.1 依赖与配置

需要补充：

- `expo-notifications`

配置侧需要补：

- `app.json` Android 通知图标 / 颜色
- 读取 `projectId`

### 7.2 建议模块划分

#### `src/lib/pushNotifications.ts`

职责：

- 创建 Android notification channel
- 请求通知权限
- 获取 Expo push token
- 监听通知接收
- 监听通知点击
- 解析推送 data

#### `src/stores/pushStore.ts`

职责：

- 持有权限状态
- 持有 push token
- 持有偏好设置
- 提供初始化、注册设备、刷新偏好等动作

#### 设置页改造

文件：

- `src/app/settings.tsx`

改造方向：

- `消息通知` 开关不再使用本地 `useState`
- 读取并更新 `push_preferences.push_enabled`
- 后续可继续扩展分类级开关

### 7.3 根布局接入

建议在根布局或应用启动阶段统一完成：

1. 初始化 Android channel
2. 校验权限
3. 获取 Expo push token
4. 登录后上报设备
5. 绑定前台通知监听
6. 绑定点击通知监听

说明：

- 不建议把推送初始化散落到多个页面。
- 根布局是当前仓库最合适的统一入口。

## 8. 服务端设计

### 8.1 Edge Function：`register-push-device`

职责：

- 校验登录态
- 根据 `expo_push_token` upsert 设备记录
- 记录平台、版本、设备名、最后活跃时间
- 自动创建默认 `push_preferences`（若不存在）

### 8.2 Edge Function：`unregister-push-device`

职责：

- 退出登录或 token 失效时停用设备
- 可按 `expo_push_token` 或设备 id 操作

### 8.3 Edge Function：`dispatch-push-queue`

职责：

- 读取待发送任务
- 过滤用户偏好
- 查询活跃设备
- 调用 Expo Push API
- 写发送日志
- 更新任务状态

说明：

- V1 可先做手动触发或管理端触发
- 后续再演进为定时调度

## 9. 数据库触发器与策略

### 9.1 触发器

建议新增：

- `notifications` 插入后，根据 `type / related_type` 决定是否写入 `push_dispatch_queue`
- `push_*` 表统一 `updated_at` 触发器

### 9.2 推送类型映射建议

- 订单通知：`push_type='order'`
- 售后通知：`push_type='after_sale'`
- 社区互动：`push_type='community'`

### 9.3 RLS 策略

`push_devices`

- 用户可读取自己的设备
- 用户只能管理自己的设备

`push_preferences`

- 用户可读取 / 更新自己的偏好

`push_dispatch_queue`

- 前台用户不直接读写
- 由 service role 和 Edge Function 管理

`push_delivery_logs`

- 前台用户不直接访问
- 由 service role 管理

## 10. V1 点击路由规范

建议统一复用当前路由构造器：

- `routes.tracking(orderId)`
- `routes.afterSaleDetail(requestId)`
- `routes.post(postId)`

客户端收到通知点击时不要手写字符串跳转，避免路径继续分散。

## 11. 失败与降级策略

### 11.1 客户端

- 权限拒绝：不反复弹窗骚扰，只记录状态并在设置页提示
- 非真机：显示“需在真机验证推送”
- token 获取失败：允许重试，不阻塞应用主流程

### 11.2 服务端

- Expo API 调用失败：记录 `push_delivery_logs`
- token 失效：标记设备 `is_active=false`
- 偏好关闭：队列状态置为 `skipped`
- 没有设备：队列状态置为 `skipped`

## 12. 页面 / Store / 数据库 / 函数 四层实施清单

### 页面

- 改造 `settings.tsx`，接真实推送开关
- 根布局接推送初始化与点击跳转
- 必要时补一个“通知权限未开启”的提示态

### Store

- 新增 `pushStore.ts`
- 与现有 `notificationStore` 解耦，不把推送注册逻辑塞进消息列表 store

### 数据库

- 新建 `push_devices`
- 新建 `push_preferences`
- 新建 `push_dispatch_queue`
- 新建 `push_delivery_logs`
- 新增 `notifications -> push_dispatch_queue` 触发器

### Edge Functions

- `register-push-device`
- `unregister-push-device`
- `dispatch-push-queue`

## 13. 验收标准

- Android 真机登录后可成功注册 Expo push token
- 设置页开关可真实影响推送队列是否投递
- 订单、售后、社区互动通知写入后可进入 push queue
- Expo Push Service 调用结果会落日志
- 点击推送可正确打开 App 并跳到对应页面

## 14. 与现有仓库的关系

本设计默认复用：

- 现有 `notifications` 表与消息中心
- 现有订单、售后、社区路由
- 当前 Android First 技术方向

本设计不会改变：

- 业务域继续写站内消息的方式
- 订单 / 售后 / 社区的核心业务状态机

## 15. 后续阶段

推送通知系统完成后，再进入以下扩展方向：

1. iOS 真机推送联调
2. 活动运营推送
3. 更细粒度的通知分类开关
4. 频控、去重和批量发送后台
