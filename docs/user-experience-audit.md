# 李记茶 App — 用户视角深度体验报告

> 审计日期：2026-04-04
> 项目版本：2.7.0
> 审计视角：高频重度用户

---

## 一、致命问题（会直接劝退用户）

### 1. 支付页面金额显示乱码

- **文件**：`src/app/payment.tsx`
- **现象**：所有支付金额显示为 `楼 128.00` 而不是 `¥128.00`。确认支付、等待中、成功、失败四个阶段全部如此。
- **影响**：作为用户，看到付款金额是乱码，会直接放弃购买。

### 2. 赠茶礼功能完全无法使用

- **文件**：`src/app/gift.tsx`
- **现象**：精心选好礼品卡、写好祝福语、填好收件人信息，点击"赠送茶礼"按钮——没有任何反应。按钮没有 `onPress`。收件人的姓名和手机号输入框是 uncontrolled 的（无 `value`/`onChangeText`），填了也白填。
- **影响**：整个赠礼流程完全不可用。

### 3. 过期订单的库存永远不会释放

- **文件**：`src/stores/orderStore.ts`
- **现象**：`closeExpiredPendingOrder` 是一个纯本地 stub，从不调用数据库。用户下单后不付款，10分钟后订单虽然在界面上显示"已取消"，但数据库里仍是 `pending`，预留的库存永远不会归还。
- **影响**：随着时间推移，商品会显示"缺货"但实际有库存。

---

## 二、严重体验问题（用户会觉得"这App没做完"）

### 4. 商品详情没有数量选择器

- **文件**：`src/app/product/[id].tsx`
- **现象**：每次只能加1件。想买3份同款茶叶？要点3次"加入购物车"。"立即购买"更离谱，hardcode 数量为1，无法更改。

### 5. 社区故事圈点了没反应

- **文件**：`src/components/community/StoryRow.tsx`
- **现象**：首页社区有 Instagram 风格的故事圆圈，点击后只是标记为已读，没有任何查看器。圆圈从彩色变灰色，但什么内容都看不到。

### 6. 帖子列表里点赞/收藏无效

- **文件**：`src/components/community/PostCard.tsx`
- **现象**：社区 feed 里的爱心和收藏图标看起来可以点，但完全没有 `onPress`。只有进入帖子详情页才能点赞。用户会反复点击然后困惑"为什么没反应"。

### 7. 收货地址无法编辑

- **文件**：`src/stores/userStore.ts`
- **现象**：地址写错了？只能删除重建。没有编辑功能。作为一个有多个收货地址的用户，这非常糟糕。

### 8. 结算页无法切换地址

- **文件**：`src/app/checkout.tsx`
- **现象**：地址卡片右侧有个箭头暗示可以点，但实际上选中默认地址后就锁死了。如果想寄到公司而不是家里，只能退出去改默认地址再回来。

### 9. 没有取消订单按钮

- **现象**：下单后反悔了，只能等10分钟超时。没有任何"取消订单"入口。

### 10. 没有确认收货按钮

- **文件**：`src/app/tracking.tsx`
- **现象**：快递显示已签收，但没有"确认收货"按钮。`canAdvanceLogistics` 只在 `__DEV__` 模式下显示。

### 11. 订单列表没有下拉刷新

- **文件**：`src/app/orders.tsx`
- **现象**：`FlatList` 没有 `refreshControl`。付款后回到订单列表，状态不会自动更新，必须退出再进入。

---

## 三、功能缺失（用户会问"怎么没有这个？"）

### 12. 忘记密码无找回入口

- **文件**：`src/app/login.tsx`
- **现象**：登录页没有"忘记密码"链接。忘了密码的用户直接被锁在外面。

### 13. 商城列表没有快速加购按钮

- **文件**：`src/components/shop/ShopProductCard.tsx`
- **现象**：浏览商城时，每个商品卡片没有"+"按钮。想加购必须点进详情页。竞品（盒马、叮咚买菜）都有列表级快速加购。只有首页的"新品上架"区域有快速加购。

### 14. 搜索历史不持久化

- **文件**：`src/app/search.tsx`
- **现象**：搜索历史是 `useState` 初始化的硬编码假数据（"龙井"、"白毫银针"等），每次重启App就丢失。

### 15. 没有"我的帖子"入口

- **现象**：发了帖子之后，在个人中心找不到自己的帖子列表。也无法编辑或删除已发的帖子。

### 16. 帖子没有管理功能

- **文件**：`src/app/post/[id].tsx`
- **现象**：三点菜单点击后显示"帖子管理功能会在下一版补齐"。没有举报、编辑、删除。

### 17. 通知铃铛和消息都是空壳

- **文件**：`src/components/home/TopAppBar.tsx`
- **现象**：顶部通知铃铛点击后弹窗"消息通知功能即将上线"。

### 18. 个人中心三个菜单项是假的

- **文件**：`src/components/profile/MenuList.tsx`
- **现象**："我的评价"、"冲泡记录"、"邀请好友"全部弹窗"即将上线"。

### 19. AR识茶是纯原型

- **文件**：`src/app/ar-scan.tsx`
- **现象**：没有使用真实摄像头，背景是一张 Unsplash 图片。闪光灯、相册、历史记录按钮全无 `onPress`。点击"识别"永远返回"特级西湖龙井，匹配度96%"。

---

## 四、数据与安全隐患

| 问题 | 位置 | 影响 |
|---|---|---|
| 优惠券领取无原子性保护 | `supabase/functions/_shared/coupon.ts` | 并发请求可超领 `total_limit` |
| `ali-login` 查询不存在的 `profiles.user_id` 列 | `supabase/functions/ali-login/index.ts` | 每次手机登录都创建新用户，老用户数据丢失 |
| `create-order` 未校验地址所有权 | `supabase/functions/create-order/index.ts` | 可传入其他用户的 addressId |
| `CancelPendingOrderResponse` 驼峰/蛇形不匹配 | `src/lib/order.ts` | `orderStatus`/`paymentStatus` 永远是 undefined |
| CORS 通配符 `*` | `supabase/functions/_shared/http.ts` | 生产环境安全风险 |
| `mock-logistics-update` 无权限校验 | `supabase/functions/mock-logistics-update/index.ts` | 任何用户可推进自己的物流到"已签收" |
| 购物车加购不校验库存 | `src/stores/cartStore.ts` | 可加1000件库存仅1件的商品，结算时才报错 |
| 收藏夹乐观更新无回滚 | `src/stores/userStore.ts` | 网络失败后UI和数据库不一致 |
| 默认地址设置非原子操作 | `src/stores/userStore.ts` | 并发可导致多个地址同时为默认 |

---

## 五、体验细节

| 问题 | 说明 |
|---|---|
| 启动进度条只到40% | `src/app/index.tsx` 的 `outputRange` 是 `["0%", "40%"]`，永远不会填满 |
| 购物车小计没有 `.toFixed(2)` | ¥123.5 不会显示为 ¥123.50 |
| 通知开关是假的 | `src/app/settings.tsx` 的 toggle 不持久化，不请求系统权限 |
| `FeaturedArticle` 渐变不生效 | NativeWind 不支持 `bg-gradient-to-t`，文字叠在图片上没有可读性 |
| 制茶工序只高亮第一步 | `src/components/product/ProcessTimeline.tsx` 看起来像进度条而非教育内容 |
| 首页两个 Banner 都导向社区 | `SeasonalStory` 和 `CultureBanner` 指向同一个页面，浪费首页空间 |
| 删除购物车商品的"删除"文字太小 | 10px文字，无 `hitSlop`，很难点到 |
| 没有分页 | 订单/帖子/商品/文章全部硬限50-100条，超过就看不到 |
| 深链接到文章会白屏 | 没有 `fetchArticleById`，依赖列表已加载 |
| `getFunctionErrorMessage` 重复3份 | `src/lib/alipay.ts`、`payment.ts`、`order.ts` 完全一样的函数 |
| `culture.tsx` 残留文件 | `src/app/(tabs)/culture.tsx` 仅包含一个 Redirect，tab已隐藏，应删除 |
| `PENDING_ORDER_EXPIRE_MS` 重复定义 | `src/lib/trackingUtils.ts` 和 `supabase/functions/_shared/payment.ts` 各定义一份 |
| `couponStore` 使用异步 `getSession()` | 其他 store 都用同步的 `useUserStore.getState()`，此处多一次网络请求 |
| `supabase.ts` AppState 监听器未清理 | `removeSupabaseAppStateListener` 已导出但从未调用 |
| 模拟物流事件使用未来时间戳 | `supabase/functions/_shared/payment.ts` 在支付成功时写入30分钟和6小时后的假物流事件 |
| iOS 支付宝无降级方案 | `src/lib/alipayNative.ts` 在非 Android 平台直接返回 false/抛异常 |
| WeChat/银行卡支付永久 mock | `src/lib/paymentConfig.ts` 中 wechat/card 硬编码为 `enabled: false, isMock: true` |

---

## 六、优先级建议

### P0 — 必须立即修复（影响核心交易链路）

1. 修复支付页 `楼` → `¥` 货币符号
2. 修复过期订单库存释放逻辑（调用 `cancelPendingOrderAndRestoreStock` RPC）
3. 修复 `ali-login` 的 `profiles.user_id` → `id` 查询
4. 修复 `CancelPendingOrderResponse` 的驼峰/蛇形字段不匹配

### P1 — 高优先级（直接影响用户留存）

5. 商品详情加数量选择器
6. 地址编辑功能
7. 结算页地址切换
8. 取消订单功能
9. 确认收货功能
10. 订单列表下拉刷新
11. 忘记密码流程
12. 优惠券并发领取的原子性保护

### P2 — 中优先级（完善社区和内容体验）

13. 社区帖子列表的点赞/收藏交互
14. 故事查看器
15. 帖子管理（编辑/删除/举报）
16. "我的帖子"入口
17. 搜索历史持久化
18. 列表分页

### P3 — 低优先级（锦上添花）

19. 商城列表快速加购
20. 通知系统
21. 我的评价/冲泡记录
22. AR识茶真实实现
23. 赠茶礼完整流程

---

## 总体评价

**核心购物流程（浏览→详情→购物车→结算→支付宝付款）的骨架是完整的**，服务端的定价校验、库存预留、支付回调都做得很扎实。但从"能用"到"好用"还有不少差距——尤其是支付页乱码、无法取消订单、无法编辑地址这些日常高频操作的缺失，会让用户觉得这个App还处于 beta 阶段。

社区模块的完成度大约在 **60%**，很多交互元素看起来能点但点了没反应，这种"看得到摸不到"的体验比没有更糟。

建议按 P0 → P1 → P2 → P3 的顺序逐步修复，先确保核心交易链路无 bug，再完善周边功能。
