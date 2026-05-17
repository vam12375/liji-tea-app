# 项目优化分析报告

生成时间：2026-04-09

## 1. 分析范围

本次分析基于当前工作区的静态代码审查完成，重点覆盖了以下模块：

- `package.json`、`tsconfig.json`、`.gitignore`
- `src/app` 路由页面
- `src/stores` 状态管理
- `src/hooks` 页面流程编排
- `src/lib` 客户端服务层与支付链路
- `supabase/functions` 与共享服务端逻辑
- `modules` 下的原生模块目录
- `tests` 当前已有的纯函数与流程测试

本次没有执行以下动作：

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- 原生 Android 构建
- 支付真机联调
- Supabase 远程部署验证

结论因此偏向工程结构、状态一致性、配置风险和测试覆盖层面，不代表真机运行表现已经完全验证。

---

## 2. 总体判断

这个项目已经明显超出“Expo UI 原型”的阶段。

当前仓库已经具备比较完整的业务骨架：

- 路由层已经成型，首页、商城、内容、社区、订单、支付、物流等主流程齐全。
- Zustand store 已经开始承担真实业务状态，而不只是临时页面状态。
- 支付、订单、物流、优惠券、登录链路已经接入到 Supabase 和 Edge Functions。
- 原生能力通过 `modules/` 目录管理，而不是把 Kotlin 代码散落在业务目录里，这个方向是对的。

但当前项目也进入了一个典型的“继续堆功能会开始变慢”的阶段。问题不在于页面数量不够，而在于几条核心链路已经出现以下迹象：

1. 前端配置默认值对真实业务过于宽松。
2. 页面与 store 的订阅边界有局部失稳。
3. 某些 store 和 screen 已经开始承担过多职责。
4. 优惠券、支付、社区这些中等复杂业务存在重复请求、重复逻辑和回归风险。
5. 测试覆盖还主要停留在纯函数层，对关键页面协作层保护不足。

结论很直接：当前更适合优先做一轮“稳定性收敛”和“边界收口”，而不是继续无约束扩业务。

---

## 3. 优先级总览

### P0：建议立即处理

- 支付渠道配置默认开启 mock，存在误暴露风险
- 结算页默认地址订阅方式不稳，可能使用旧地址下单
- 社区分页直接拼接列表，存在重复数据风险
- 优惠券链路存在重复请求和调用入口分叉

### P1：建议近期处理

- `userStore` 写操作缺少原子性和失败回滚
- 多个大文件已经出现职责堆叠
- 社区头像 fallback 依赖第三方服务

### P2：建议后续治理

- 增强页面与 store 协作层测试
- 将重复的业务映射和选择器继续下沉
- 清理性能与缓存策略上的重复拉取

---

## 4. P0 级问题

### P0.1 支付渠道当前是“默认放开”，而不是“默认关闭”

这是当前最值得优先收口的工程风险。

证据：

- `src/lib/paymentConfig.ts:22-23` 中，支付宝是否启用由 `EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED` 控制。
- `src/lib/paymentConfig.ts:29-30` 中，微信支付缺省为 `true`。
- `src/lib/paymentConfig.ts:36-37` 中，银行卡支付缺省也为 `true`。
- `src/components/checkout/PaymentMethods.tsx:60` 会读取 `getEnabledPaymentChannels()`。
- `src/components/checkout/PaymentMethods.tsx:81` 会把所有已启用渠道直接渲染到结算页。
- `src/components/checkout/PaymentMethods.tsx:100` 会根据 `config.isMock` 展示“当前为后端模拟支付链路”。
- `src/lib/paymentFlow.ts:181` 定义了执行器分发逻辑。
- `src/lib/paymentFlow.ts:319-321` 中，凡是不是 `alipay` 的渠道，都会直接走 mock 执行器。

影响：

- 只要环境变量漏配，`wechat` 和 `card` 仍会展示给用户。
- 这些渠道会继续走 `mock-payment-confirm` 这条链路，而不是被显式禁用。
- 对内测环境这可能是方便，但对预发布或线上环境是高风险配置。

建议：

- 将 `wechat` 和 `card` 的默认值改为 `false`，只有显式开启才展示。
- 明确区分开发态 mock 和生产态真实渠道，避免隐式回退。
- 给支付配置补一层“生产环境禁止 mock 渠道”的保护。

### P0.2 结算页对默认地址的订阅边界不稳定

这个问题不是代码风格问题，而是会直接影响下单行为。

证据：

- `src/app/checkout.tsx:41` 通过 `useUserStore((state) => state.getDefaultAddress)` 取的是一个方法。
- `src/app/checkout.tsx:86` 再执行 `const address = getDefaultAddress()`。
- `src/stores/userStore.ts:394` 中，`getDefaultAddress` 只是同步读取 `get().addresses.find(...)`。

问题本质：

- 组件没有直接订阅 `addresses` 或“默认地址”这个派生值。
- 它订阅的是函数引用，而不是函数读取出来的结果。
- 如果地址列表变化，但函数引用本身没变，页面不一定会重渲染。

潜在后果：

- 用户新增地址、修改默认地址、切换默认地址后，返回结算页可能仍看到旧地址。
- 提交订单时可能把旧 `address.id` 带到服务端。

建议：

- 在 `checkout.tsx` 里直接订阅默认地址 selector，而不是订阅 getter。
- 更进一步，可以在 `userStore` 内提供稳定的 selector 或派生字段，避免页面层重复计算。

### P0.3 社区分页加载存在重复数据风险

社区列表当前的分页拼接方式不够稳。

证据：

- `src/stores/communityStore.ts:460` 使用 `posts: [...state.posts, ...newPosts]` 直接拼接。

问题本质：

- 分页加载没有基于 `id` 做 merge / upsert。
- 只要“刷新 + 加载更多”或“分页期间有新帖子插入”，就有机会把重复项拼进列表。

影响：

- 社区 feed 出现重复卡片。
- 后续点赞、收藏、详情同步容易出现列表与详情不一致。

建议：

- 参照 `orderStore` 的处理方式，为 `communityStore` 引入基于 `id` 的去重 merge。
- 为社区分页补一条专门的回归测试，覆盖“先刷新再加载更多”的场景。

### P0.4 优惠券链路有明显的重复拉取和调用入口分叉

当前优惠券功能可用，但工程边界还不够收口。

证据：

- `src/app/_layout.tsx:61` 启动阶段会拉一次公开优惠券。
- `src/app/_layout.tsx:107` 登录后会拉一次用户优惠券。
- `src/app/checkout.tsx:126` 结算页进入后又会拉一次用户优惠券。
- `src/app/coupons.tsx:162-164` 优惠券页进入后再次拉公开券和用户券。
- `src/stores/couponStore.ts:223` 领取成功后还会同时刷新公开券和用户券。
- `src/stores/couponStore.ts:207` 目前直接调用 `supabase.functions.invoke(...)`。
- `src/lib/supabaseFunction.ts:293` 和 `src/lib/supabaseFunction.ts:360` 已经有统一的 Edge Function 调用封装与严格模式。

问题本质：

- 相同数据在多个页面和根布局重复触发请求。
- `claimCoupon` 没有复用共享的错误归一、鉴权刷新和返回校验逻辑。
- `couponStore` 里的映射函数仍然依赖 `any`，类型边界不够稳。

影响：

- 请求次数偏多，页面切换时容易重复加载。
- 错误处理风格不统一，后续维护者要记两套调用方式。
- 某些异常只会在特定入口下表现出来，不利于排查。

建议：

- 给优惠券请求加一层 TTL 或 in-flight 去重。
- 统一将 `claimCoupon` 接入 `invokeSupabaseFunctionStrict`。
- 补齐 `mapCoupon` / `mapUserCoupon` 的类型守卫，逐步清理 `any`。

---

## 5. P1 级问题

### P1.1 `userStore` 的写操作缺少原子性与失败补偿

证据：

- `src/stores/userStore.ts:302` 的新增地址逻辑，若设为默认会先把其他地址全部取消默认。
- `src/stores/userStore.ts:342` 的更新地址逻辑，同样是两步写。
- `src/stores/userStore.ts:371` 的设置默认地址逻辑，也是先全部清空，再设置目标地址。
- `src/stores/userStore.ts:468` 的收藏逻辑是乐观更新后 fire-and-forget，不做失败回滚。

影响：

- 地址默认值更新在弱网或异常场景下可能出现中间态。
- 收藏按钮在网络失败时，UI 和服务端状态可能不一致。

建议：

- 默认地址逻辑改为 RPC 或数据库约束统一处理，保证原子性。
- 收藏的乐观更新至少补失败回滚和错误日志。

### P1.2 大文件开始堆职责，维护成本会继续上升

从文件体量和内容职责看，以下文件已经进入“需要拆”的阶段：

- `src/app/tracking.tsx`
- `src/stores/communityStore.ts`
- `src/app/coupons.tsx`
- `src/stores/userStore.ts`
- `src/lib/paymentFlow.ts`

这类文件的问题不在于代码无法运行，而在于：

- 查询逻辑、派生逻辑、映射逻辑、展示逻辑混在一起。
- 后续修一个小需求，容易牵动多个无关分支。
- 回归测试难以覆盖到真正的边界。

建议：

- 优先按业务边界拆，而不是按“每 200 行拆一个文件”这种机械方式拆。
- 例如 `communityStore` 可以拆成 mapper、query、interaction 三层。
- `tracking.tsx` 可以继续下沉为“订阅 / 事件 / 派生状态 / 展示区块”四层。

### P1.3 社区头像 fallback 依赖第三方头像服务

证据：

- `src/stores/communityStore.ts:198` 当前通过 `ui-avatars.com` 拼接默认头像。

问题：

- 会把用户昵称参数带出站。
- 弱网下多一层外部网络依赖。
- 头像失败时列表首屏稳定性受影响。

建议：

- 使用本地占位图或服务端统一生成的头像 URL。
- 如果继续使用第三方服务，至少要确认是否符合隐私和稳定性要求。

---

## 6. P2 级问题

### P2.1 测试覆盖还主要停留在纯函数层

当前测试覆盖包括：

- `tests/paymentFlow.test.ts`
- `tests/trackingUtils.test.ts`
- `tests/orderTiming.test.ts`
- `tests/orderRpc.test.ts`
- `tests/routes.test.ts`
- `tests/aliOneClickSupport.test.ts`

这些测试是有价值的，但当前最容易出回归的问题已经不只在纯函数层，而是在：

- 页面与 store 的订阅边界
- 配置默认值是否安全
- 分页与刷新叠加时的列表一致性
- 优惠券与结算链路的联动状态

建议优先新增的测试：

1. 结算页默认地址切换回归测试
2. 支付渠道配置回归测试
3. 社区分页去重测试
4. 优惠券选择与失效回退测试

### P2.2 缓存与请求去重策略还可以继续统一

当前仓库已经有一部分“只拉一次”思路，例如根布局里对公开券做了轻量缓存控制，但整体还没有形成统一模式。

建议：

- 为“公开券、用户券、订单详情、社区列表”这几类高频数据统一请求策略。
- 约定哪些由页面拉取，哪些由根布局预热，哪些由 store 内部做幂等控制。

---

## 7. 建议的整改顺序

建议按下面顺序推进，收益最高，且对现有业务影响最可控：

1. 收紧支付渠道配置，默认关闭 mock 渠道。
2. 修复结算页默认地址订阅方式。
3. 收敛优惠券请求入口，统一走共享 Edge Function 调用层。
4. 修复社区分页去重逻辑。
5. 为以上 4 项补回归测试。
6. 再开始拆 `userStore`、`communityStore`、`tracking.tsx` 这几个大文件。

---

## 8. 最终结论

当前项目的方向是对的，尤其是：

- 服务端重新验价与原子下单的思路是对的。
- 支付流程状态机化的方向是对的。
- 原生模块与 Expo 业务层分离的方向也是对的。

但如果从“能继续长期维护”的角度看，现在最需要的不是再加页面，而是先把以下三件事做实：

1. 配置默认值要更保守。
2. 页面与 store 的订阅边界要更稳定。
3. 对关键协作层补测试，而不是只测纯函数。

如果这轮优化不做，后续继续叠加功能时，支付、结算、优惠券、社区四块会逐渐变成主要维护成本来源。

