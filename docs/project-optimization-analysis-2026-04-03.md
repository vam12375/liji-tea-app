# 项目优化分析报告

生成时间：2026-04-03

## 1. 分析范围

本次分析基于当前工作区代码静态检查完成，重点覆盖了以下目录和配置：

- `package.json`、`app.json`、`tsconfig.json`、`.gitignore`
- `src/app` 路由页面
- `src/stores` 状态管理
- `src/lib` 客户端服务层
- `modules` 原生模块桥接
- `supabase/functions` 与迁移脚本

本次额外执行了两项工程校验：

- `npm run lint`
  结果：通过
- `npx tsc --noEmit`
  结果：失败，共 7 个错误

说明：

- 本次没有运行原生 Android 构建、E2E、支付真机链路、Supabase 远程部署验证。
- 仓库当前存在未提交改动，本报告基于当前工作树状态分析，未改动你已有文件。

## 2. 总体判断

这个项目已经不是简单的 Expo UI Demo 了，已经具备较完整的业务骨架：

- 前端有明确的路由分层，页面数量完整。
- 状态层已经开始向业务 store 聚合。
- 支付、订单、物流、一键登录都已经进入“真实业务链路”阶段。
- Supabase Edge Functions 已经承担了部分关键职责，这个方向是对的。

但项目当前还不适合继续无约束地堆功能。核心原因不是 UI，而是工程边界开始失稳，主要体现在：

1. 类型系统已经失守，`lint` 能过但 `tsc` 过不去。
2. 登录、订单、支付这三条主链路还有边界不一致的问题。
3. 页面和 store 已经出现“单文件承担过多职责”的趋势。
4. 配置项、文档、真实能力与当前代码之间存在几处错位。

如果现在继续叠加新需求，后续维护成本会明显上升。更合理的做法是先补一轮“稳定性优化”，再继续扩展业务。

## 3. 当前项目的主要优点

- `src/lib/order.ts` 已经把订单报价和创建收口到服务端函数，方向正确。
- `supabase/functions/_shared/payment.ts` 抽出了支付共用逻辑，说明后端职责正在形成。
- 首页、商城、社区、订单、支付、物流等主流程已经串起来，适合进入“收敛和固化”阶段。
- 原生模块拆进 `modules/`，而不是直接把 Kotlin 代码散落到业务目录里，这点是好的。

## 4. 高优先级问题

### P0. 一键登录模块存在双实现分裂，TypeScript 已经被打断

这是当前最明确、最应该先修的问题。

证据：

- `src/hooks/useOneClickLogin.ts:55` 调用了 `AliOneClickModule.initWithToken(...)`
- `src/hooks/useOneClickLogin.ts:61` 调用了 `AliOneClickModule.login(templateId)`
- 但 `src/modules/ali-one-login.ts:50` 导出的却是一个桩实现，只提供 `checkEnvAvailable / login / quit`
- `modules/ali-one-login/index.ts:1` 又错误地导出了一个并不存在的命名导出 `AliOneClickModule`
- `modules/ali-one-login/src/AliOneClickModule.ts:53` 还写了非法的类型谓词，直接触发 `tsc` 报错

`npx tsc --noEmit` 的失败项里，和这一块直接相关的错误有：

- `src/hooks/useOneClickLogin.ts` 上的 3 个错误
- `modules/ali-one-login/index.ts` 上的 1 个错误
- `modules/ali-one-login/src/AliOneClickModule.ts` 上的 3 个错误

影响：

- 一键登录当前不是“待完善”，而是“构建层已经不一致”。
- 后续任何人只要把 `typecheck` 拉进 CI，就会立即失败。
- 代码阅读者很难判断当前业务到底应该依赖 `src/modules/ali-one-login.ts` 还是 `modules/ali-one-login/`。

建议：

1. 只保留一个一键登录入口。
2. 如果真实实现已经在 `modules/ali-one-login/`，就删除或改名 `src/modules/ali-one-login.ts`，避免路径别名误导。
3. 修正 `modules/ali-one-login/index.ts` 的导出方式。
4. 修正 `modules/ali-one-login/src/AliOneClickModule.ts` 的类型守卫写法。
5. 把 `npm run typecheck` 变成日常校验。

### P0. 订单创建没有事务化的库存保留逻辑，存在超卖风险

`supabase/functions/create-order/index.ts` 现在只是“读取库存后判断能不能下单”，但没有做真正的库存保留或扣减。

证据：

- `supabase/functions/create-order/index.ts:160-208` 只读取 `products.stock` 并检查库存
- `supabase/functions/create-order/index.ts:217-260` 插入 `orders` 和 `order_items`
- 全仓库没有任何地方更新 `products.stock`

影响：

- 两个用户并发下单时，都会通过库存检查。
- 订单成功创建后，库存仍然不变，库存展示和真实可售量会脱节。
- 这条链路一旦接近真实支付，就会变成业务事故，不只是代码味道问题。

建议：

1. 把“校验库存 + 创建订单 + 保留库存”收敛到单个事务里处理。
2. 优先考虑用 SQL function / RPC 完成，而不是继续在 Edge Function 里拼多步写操作。
3. 明确库存策略：是“下单占库存”还是“支付成功占库存”，不要夹在中间态。
4. 如果暂时不扣库存，至少要增加“预占库存表 + 失效回收”机制。

### P1. 被动退出登录时，用户态数据不会被清空

当前只有手动调用 `signOut()` 时，用户资料、地址、收藏和购物车会被清空；但如果是 token 失效、会话过期、或外部登录态变化，`_layout` 里的监听并不会做同样的清理。

证据：

- `src/app/_layout.tsx:51-58` 的 `onAuthStateChange` 只调用了 `setSession(session)`
- `src/stores/userStore.ts:98-103` 的 `setSession` 只更新 `session` 和派生字段，不会清空 `profile / addresses / favorites`
- 真正清空用户数据的逻辑只在 `src/stores/userStore.ts:135-150` 的 `signOut()` 里

影响：

- 用户会话被动失效后，界面可能继续显示上一位用户的地址和收藏。
- 这是典型的“状态泄漏”问题，优先级高于普通 UI Bug。

建议：

1. 在 `setSession(null)` 时同步清空所有 user-scoped 状态。
2. 或者在 `_layout.tsx` 中对 `session === null` 单独走一次清理分支。
3. 这类清理逻辑应只保留一个出口，避免业务分叉。

### P1. 商品详情页不支持冷启动和深链

商品详情页直接从 `useProductStore().products` 里取数据，但页面本身不负责兜底加载。

证据：

- `src/app/product/[id].tsx:31-33` 直接 `find` 当前商品
- `src/app/product/[id].tsx:207-213` 找不到商品就直接展示“产品未找到”
- 但 `src/stores/productStore.ts:84-100` 明明已经提供了 `fetchProductById()`
- `fetchProducts()` 只在首页和商城页被调用，见 `src/app/(tabs)/index.tsx:28-30`、`src/app/(tabs)/shop.tsx:100`

影响：

- 直接打开 `/product/[id]` 时，如果用户没有先经过首页或商城页，详情页会误判为商品不存在。
- 分享跳转、推送跳转、H5 深链跳转都会受影响。

建议：

1. 详情页优先读缓存，缓存没有时再调用 `fetchProductById(id)`。
2. 区分“加载中”和“确实不存在”，不要直接把空缓存当成不存在。

### P1. `typedRoutes` 已启用，但大量 `as any` 直接绕过了它

项目在 `app.json` 中已经打开了 `typedRoutes`，但实际路由跳转层仍然在大面积使用 `as any`。

证据：

- `app.json` 已开启 `typedRoutes`
- 全仓库共有 `42` 处 `as any`
- 例如：
  - `src/app/checkout.tsx:118`
  - `src/app/payment.tsx:139`
  - `src/app/post/[id].tsx:42`
  - `src/components/profile/MenuList.tsx:35`

影响：

- 路由参数改名、页面重构时，编译器帮不上忙。
- 现在虽然“能跳”，但这相当于主动关闭了 Expo Router 提供的类型保护。

建议：

1. 先清理高频页面的 `router.push(... as any)`。
2. 把常用路由封装成小型 helper，减少字符串拼接。
3. 不要一边开 `typedRoutes`，一边用 `as any` 把它全部绕掉。

### P1. 支付渠道开关没有真正接入页面

项目已经配置了支付开关环境变量，但页面并没有读取这些开关。

证据：

- `.env.example:49-59` 定义了 `EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED`、`EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED`、`EXPO_PUBLIC_PAYMENT_ENV`
- `src/components/checkout/PaymentMethods.tsx:6-31` 仍然把 `alipay / wechat / card` 全部写成 `enabled: true`
- 搜索结果显示，前端代码实际上只读取了 `EXPO_PUBLIC_WEB_URL`，支付开关没有被消费

影响：

- 配置项形同虚设。
- 没法按环境做灰度，也没法安全地下掉未完成渠道。

建议：

1. 支付方式展示必须读取环境变量。
2. “模拟支付”渠道和“真实支付”渠道应该在 UI 上明确区分。
3. `payment.tsx` 不要默认把任意非支付宝都当成可用模拟通道。

### P1. 工程校验链不完整，`lint` 通过并不代表项目可维护

当前脚本只有 `lint`，没有 `typecheck`、没有测试、没有组合校验。

证据：

- `package.json:4-13` 只有 `start / android / ios / web / lint` 等脚本
- `npm run lint` 能通过
- 但 `npx tsc --noEmit` 仍然失败

影响：

- 团队会产生“绿色即安全”的错觉。
- 类型错误很容易在多人协作里累积成技术债。

建议：

1. 增加 `typecheck` 脚本。
2. 增加 `check` 脚本，至少串联 `lint + typecheck`。
3. 后续补一个最小 CI，把这两个动作放进去。

## 5. 中优先级优化项

### P2. 列表查询全部走全量拉取，缺少分页和增量加载

当前产品、文章、社区帖子、故事流都是全量查询。

证据：

- `src/stores/productStore.ts:67-77`
- `src/stores/articleStore.ts:112-131`
- `src/stores/communityStore.ts:314-377`

影响：

- 数据量小时没问题，但数据一旦上来，首屏延迟和内存占用会同步升高。
- 社区和内容页会比商城页更早出现性能压力。

建议：

1. 先给社区帖子和文章流加分页。
2. 首页只拉首屏需要的数据，不要每次都拿全量。
3. 明确每个列表的缓存策略和失效策略。

### P2. 页面文件和 store 文件已经偏大，继续迭代会放大维护成本

目前几个核心页面和 store 已经承担了太多职责。

典型文件：

- `src/app/tracking.tsx`
- `src/app/payment.tsx`
- `src/app/community/create.tsx`
- `src/app/product/[id].tsx`
- `src/stores/communityStore.ts`

问题不在于“行数大”本身，而在于这些文件同时承担了：

- 数据读取
- 表单处理
- UI 状态
- 动画
- 路由跳转
- 错误处理
- 部分业务规则

建议：

1. 把页面逻辑拆成 `screen + hook + pure section component`。
2. 把社区和订单的映射函数、交互函数、查询函数从 store 里拆出去。
3. store 只保留状态和有限的状态变更，不要继续塞业务编排。

### P2. 仍有大量 `any`，类型边界没有收紧

统计结果：

- `any` 共有 `72` 处

比较典型的区域：

- `src/stores/communityStore.ts`
- `src/stores/userStore.ts`
- `src/stores/orderStore.ts`
- `src/hooks/useOneClickLogin.ts`

影响：

- 这会把原本应该在编译期暴露的问题推迟到运行期。
- 一键登录这次的问题，本质上就是类型边界失守后的外溢结果。

建议：

1. 先把支付、登录、订单三条主链路上的 `any` 去掉。
2. Supabase 查询结果优先建立显式 row type，再做映射。
3. 不要继续扩散 `payload.new as any` 这类写法。

### P2. `docs/` 被 `.gitignore` 忽略，新文档默认进不了版本控制

证据：

- `.gitignore:66-68` 直接忽略了 `docs/`

影响：

- 老文档虽然已经在仓库里，但新文档会被静默忽略。
- 这会让“补文档”这件事在协作里非常容易失效。

建议：

1. 如果 `docs/` 是正式交付物，就不要整体忽略。
2. 如果只想忽略某些临时文档，应该缩小 ignore 范围，而不是整目录忽略。

### P2. 社区默认头像依赖第三方公开服务

证据：

- `src/stores/communityStore.ts:156-159` 使用了 `ui-avatars.com`

影响：

- 用户昵称会暴露给第三方服务。
- 离线、弱网或第三方限流时，头像会失效。

建议：

1. 优先用本地占位头像或服务端生成默认头像 URL。
2. 如果继续使用第三方头像服务，至少要在隐私和降级方案上做明确处理。

## 6. 优先执行顺序

### 第 1 阶段：先把工程稳定住

1. 修复一键登录模块的双实现冲突。
2. 增加 `npm run typecheck`。
3. 清理主链路上的 `as any` 和关键 `any`。
4. 修复被动退出登录后的状态清理问题。

### 第 2 阶段：加固订单与支付边界

1. 把库存检查和订单创建改成事务化方案。
2. 明确库存扣减策略。
3. 把支付渠道开关真正接入前端页面。
4. 继续减少客户端直接写订单状态的逻辑，让服务端成为唯一真相源。

### 第 3 阶段：降低后续维护成本

1. 拆分 `tracking / payment / community create / product detail` 页面。
2. 为社区、文章、商品流增加分页。
3. 清理 store 里的大块映射和编排逻辑。

### 第 4 阶段：补工程护栏

1. 增加最小测试集，优先覆盖订单金额计算、支付状态流转、登录成功/失败分支。
2. 增加 CI 基础校验。
3. 修正 `docs/` 管理方式。

## 7. 建议的最小落地清单

如果只做一轮“小投入、高回报”的优化，我建议优先完成这 6 件事：

1. 修掉一键登录模块的类型和入口冲突。
2. 新增 `typecheck` 脚本并纳入日常校验。
3. 修复被动退出登录时的状态清理。
4. 给商品详情页补冷启动加载。
5. 让支付方式真正受环境变量控制。
6. 把订单创建改成至少“可原子保证库存正确”的方案。

## 8. 结论

这个项目的方向是对的，业务骨架也已经搭出来了。当前最需要的不是继续做更多页面，而是先把“构建正确性、登录链路、订单事务边界、类型约束”补稳。

一句话总结：

当前项目已经具备继续演进的基础，但在继续扩功能之前，最好先完成一轮“工程收口”，否则复杂度会开始快于业务价值增长。
