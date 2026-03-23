# 三大模块完善修复计划 (首页 / 商城 / 我的)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复首页、商城、我的三大模块中的 23 个未完善问题，使应用达到功能可用状态。

**Architecture:** 分 4 个阶段实施：Phase 1 修复"我的"模块（最紧急），Phase 2 补全首页交互，Phase 3 补全商城交互，Phase 4 修复跨模块关联问题。每个 Task 是一个独立的可提交单元。

**Tech Stack:** Expo Router 55, React Native 0.83, Zustand 5, Supabase, NativeWind/Tailwind, TypeScript

**项目关键路径：**
- 路由文件: `src/app/` (file-based routing)
- 状态管理: `src/stores/` (Zustand)
- 组件: `src/components/`
- 类型: `src/types/database.ts`
- 设计色: `src/constants/Colors.ts`

---

## Phase 1: 我的模块 (最高优先级)

### Task 1: 添加退出登录功能

**Files:**
- Modify: `src/components/profile/MenuList.tsx`
- Modify: `src/stores/userStore.ts` (已有 signOut，无需改动)

**Step 1: 修改 MenuList 组件，添加退出登录入口和菜单项点击回调**

在 `src/components/profile/MenuList.tsx` 中：
- 导入 `useRouter`, `useUserStore`, `Alert`
- 为每个菜单项添加 `route` 字段（指向即将创建的子页面）
- 在底部新增一个"退出登录"按钮（红色文字，带确认弹窗）
- 点击退出时调用 `signOut()` 并导航到首页

```tsx
// MenuList.tsx 关键改动：
// 1. 每个 MENU_ITEMS 加 route 字段
// 2. Pressable 的 onPress 调用 router.push(item.route)
// 3. 底部新增退出按钮:
//    <Pressable onPress={handleSignOut}>
//      <Text className="text-error">退出登录</Text>
//    </Pressable>
```

**Step 2: 验证**
- 打开"我的"页面 → 滚动到底部 → 看到"退出登录"按钮
- 点击 → 弹出确认弹窗 → 确认 → 返回首页，会话清除

**Step 3: Commit**
```
feat: 我的模块 — 添加退出登录功能 + 菜单导航路由
```

---

### Task 2: 创建设置页面 (含退出登录)

**Files:**
- Create: `src/app/settings.tsx`

**Step 1: 创建设置页面**

页面包含：
- Stack.Screen header（标题"设置"，返回按钮）
- 设置项列表：通知设置（Switch）、隐私协议、关于我们、清除缓存
- 底部退出登录按钮（作为备选入口）
- 当前版本号显示（`v2.6.0`）

**Step 2: 验证**
- 我的 → 设置 → 页面正常渲染
- 退出登录可用

**Step 3: Commit**
```
feat: 创建设置页面 (通知/隐私/关于/退出登录)
```

---

### Task 3: 创建收货地址管理页面

**Files:**
- Create: `src/app/addresses.tsx`

**Step 1: 创建地址管理页面**

页面包含：
- Stack.Screen header（标题"收货地址"，返回按钮）
- 地址列表（从 `useUserStore.addresses` 读取）
- 每个地址卡片显示：姓名、电话、地址文本、默认标签
- 左滑删除 or 长按删除（用 Alert 确认）
- 点击可设为默认地址
- 底部"新增地址"按钮（弹出简易表单 — 用 Alert.prompt 或内嵌表单）
- 空状态提示："暂无收货地址"

**数据源:** `useUserStore` — `addresses`, `addAddress`, `removeAddress`, `setDefaultAddress`, `fetchAddresses`

**Step 2: 验证**
- 我的 → 收货地址管理 → 显示地址列表
- 新增 → 填写 → 提交成功
- 设为默认 → 标签更新

**Step 3: Commit**
```
feat: 创建收货地址管理页面 (增/删/设默认)
```

---

### Task 4: 创建订单列表页面

**Files:**
- Create: `src/app/orders.tsx`

**Step 1: 创建订单列表页面**

页面包含：
- Stack.Screen header（标题"我的订单"，返回按钮）
- 顶部 Tab 筛选栏：全部 / 待付款(pending) / 待发货(paid) / 待收货(shipping) / 已完成(delivered)
- 接受可选 `initialTab` 查询参数（从 OrderStatusRow 跳转时使用）
- 订单卡片列表（从 `useOrderStore.fetchOrders` 获取）
- 每个卡片显示：订单号（截取前8位）、状态标签、商品缩略图、总金额、下单时间
- 空状态："暂无相关订单"
- 点击卡片 → 跳转到订单详情（暂时跳到 `/tracking`）

**数据源:** `useOrderStore` — `orders`, `fetchOrders`, `loading`

**Step 2: 验证**
- 我的 → 我的订单 → 显示订单列表
- Tab 切换 → 正确筛选
- OrderStatusRow 的"待付款"/"待发货"等 → 跳转到对应 Tab

**Step 3: Commit**
```
feat: 创建订单列表页面 (Tab筛选 + 订单卡片)
```

---

### Task 5: 修复 OrderStatusRow 导航 + 动态 badge

**Files:**
- Modify: `src/components/profile/OrderStatusRow.tsx`

**Step 1: 修复路由和 badge**

- 给所有 STATUS_ITEMS 添加 route：
  - 待付款 → `/orders?initialTab=pending`
  - 待发货 → `/orders?initialTab=paid`
  - 待收货 → `/orders?initialTab=shipping`
  - 待评价 → `/orders?initialTab=delivered`
  - 全部订单 → `/orders`
- 从 `useOrderStore` 读取订单数据，动态计算每个状态的 badge 数量
- 如果 orderStore 还没有 fetch，触发 fetchOrders

**Step 2: 验证**
- 点击每个状态按钮 → 正确跳转到 orders 页面对应 Tab
- badge 数量反映真实订单

**Step 3: Commit**
```
fix: OrderStatusRow 全部状态添加导航 + 动态badge
```

---

### Task 6: 创建收藏页面

**Files:**
- Create: `src/app/favorites.tsx`

**Step 1: 创建收藏页面**

页面包含：
- Stack.Screen header（标题"我的收藏"，返回按钮）
- 从 `useUserStore.favorites`（产品ID数组）+ `useProductStore.products` 交叉得到收藏产品列表
- 2列网格展示（复用 ShopProductCard 组件）
- 点击跳转产品详情
- 支持取消收藏
- 空状态："还没有收藏的茶品"

**Step 2: 验证**
- 我的 → 我的收藏 → 显示收藏商品
- 取消收藏 → 列表实时更新

**Step 3: Commit**
```
feat: 创建收藏页面 (网格展示 + 取消收藏)
```

---

### Task 7: 创建编辑资料页面

**Files:**
- Create: `src/app/edit-profile.tsx`

**Step 1: 创建编辑资料页面**

页面包含：
- Stack.Screen header（标题"编辑资料"，返回按钮）
- 头像展示（点击可更换，复用 MemberHeader 中的逻辑）
- 昵称输入框（TextInput，读取 userStore.name）
- 手机号输入框（TextInput，读取 userStore.phone）
- 保存按钮 → 调用 `updateProfile({ name, phone })`
- 成功后 Alert 提示并 router.back()

**Step 2: 验证**
- 我的 → 点击头部区域或昵称 → 进入编辑页
- 修改昵称 → 保存 → 返回后看到新昵称

**Step 3: Commit**
```
feat: 创建编辑资料页面 (昵称/手机/头像)
```

---

### Task 8: 修复 StatsGrid 动态数据 + MemberHeader 进度条

**Files:**
- Modify: `src/components/profile/StatsGrid.tsx`
- Modify: `src/components/profile/MemberHeader.tsx`

**Step 1: StatsGrid 读取真实数据**

- "收藏" → `useUserStore.favorites.length`
- "足迹" → 暂保留为 0 或 "—"（无浏览记录 store）
- "关注" → 暂保留为 0（无关注功能）
- "粉丝" → 暂保留为 0（无粉丝功能）

**Step 2: MemberHeader 动态计算进度**

会员等级体系：
- 新叶会员: 0-499 积分
- 翡翠会员: 500-1999 积分
- 金叶会员: 2000+ 积分

根据 `points` 和 `memberTier` 计算：
- 当前进度百分比
- 距下一等级还需的积分

**Step 3: MemberBenefitsCard 根据等级显示**

- Modify: `src/components/profile/MemberBenefitsCard.tsx`
- 根据 `useUserStore.memberTier` 显示对应等级名称

**Step 4: 验证**
- 我的 → 收藏数量 = 实际收藏数
- 积分进度条 = 实际百分比
- 会员权益卡显示当前等级名

**Step 5: Commit**
```
fix: Profile数据动态化 — StatsGrid/MemberHeader/BenefitsCard
```

---

### Task 9: MemberHeader 添加编辑资料入口

**Files:**
- Modify: `src/components/profile/MemberHeader.tsx`

**Step 1: 添加可点击导航**

- 点击昵称区域 or 添加一个"编辑"小图标 → 跳转 `/edit-profile`
- 导入 `useRouter`

**Step 2: Commit**
```
feat: MemberHeader 添加编辑资料入口
```

---

## Phase 2: 首页模块

### Task 10: CategoryRow 点击跳转商城并带分类参数

**Files:**
- Modify: `src/components/home/CategoryRow.tsx`

**Step 1: 添加点击跳转**

- 导入 `useRouter`
- 点击分类 → `router.push('/(tabs)/shop?category=岩茶')` (使用 query param)
- 移除硬编码的 `active` 状态

**Step 2: 修改商城页面接收初始分类参数**

- Modify: `src/app/(tabs)/shop.tsx`
- 使用 `useLocalSearchParams` 读取 `category` 参数
- 初始化 `category` state 时使用参数值

**Step 3: 验证**
- 首页 → 点击"白茶" → 跳转商城 → 自动筛选白茶

**Step 4: Commit**
```
feat: 首页分类点击 → 跳转商城并自动筛选
```

---

### Task 11: NewArrivals 加号按钮加入购物车

**Files:**
- Modify: `src/components/home/NewArrivals.tsx`

**Step 1: 实现快速加购**

- 导入 `useCartStore`
- 加号按钮 `onPress={() => addItem(product)}`
- 添加 Toast/Alert 反馈："已加入购物车"

**Step 2: Commit**
```
feat: NewArrivals 加号按钮实现快速加购
```

---

### Task 12: 首页添加购物车悬浮入口

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Step 1: 添加悬浮购物车按钮**

- 在 ScrollView 外部、View 底部添加一个绝对定位的购物车图标按钮
- 从 `useCartStore.totalItems()` 读取数量 badge
- 数量为 0 时隐藏
- 点击跳转 `/cart`

**Step 2: 验证**
- 加购任意商品 → 首页右下角出现购物车 badge → 点击进入购物车

**Step 3: Commit**
```
feat: 首页添加购物车悬浮入口 (带badge)
```

---

### Task 13: 通知按钮占位 + 汉堡菜单清理

**Files:**
- Modify: `src/components/home/TopAppBar.tsx`

**Step 1: 通知按钮添加占位提示**

- 通知按钮 `onPress` → `Alert.alert('提示', '消息通知功能即将上线')`
- 移除汉堡菜单图标（或替换为 Logo 图标），因为 Tab 导航不需要汉堡菜单

**Step 2: Commit**
```
fix: TopAppBar 通知按钮添加占位提示 + 移除多余菜单图标
```

---

### Task 14: 首页添加下拉刷新

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

**Step 1: 添加 RefreshControl**

- 导入 `RefreshControl, useState`
- ScrollView 添加 `refreshControl` prop
- 下拉时调用 `fetchProducts()`

**Step 2: Commit**
```
feat: 首页添加下拉刷新
```

---

## Phase 3: 商城模块

### Task 15: 实现排序功能

**Files:**
- Modify: `src/app/(tabs)/shop.tsx`

**Step 1: 实现排序**

- 新增 state: `sort` — 'recommend' | 'price-asc' | 'price-desc' | 'newest'
- 点击排序按钮 → 弹出选项（用简单的 Modal 或 ActionSheet 风格 View）
- 在 `filteredProducts` 的 useMemo 中根据 sort 排序
- 排序选项：推荐（默认顺序）、价格从低到高、价格从高到低、最新上架

**Step 2: 验证**
- 商城 → 点击"排序: 推荐" → 弹出选项 → 选择"价格从低到高" → 产品列表重排

**Step 3: Commit**
```
feat: 商城实现排序功能 (价格/新品)
```

---

### Task 16: 商城添加购物车入口 + 空状态 + loading

**Files:**
- Modify: `src/app/(tabs)/shop.tsx`

**Step 1: 添加购物车入口**

- 在顶栏右侧添加购物车图标（替换或追加搜索图标旁）
- 从 `useCartStore.totalItems()` 显示 badge
- 点击跳转 `/cart`

**Step 2: 顶栏搜索图标添加跳转**

- 搜索图标 `onPress` → `router.push('/search')`

**Step 3: 添加 FlatList 的 ListEmptyComponent 和 loading**

- 加载中 → `ActivityIndicator`
- 筛选结果为空 → "未找到相关茶品，试试其他分类？"

**Step 4: 添加下拉刷新**

- FlatList 添加 `refreshing` 和 `onRefresh`

**Step 5: 清理汉堡菜单图标**

- 移除左上角 menu 图标（与 TopAppBar 保持一致）

**Step 6: Commit**
```
feat: 商城 — 购物车入口/搜索跳转/空状态/loading/下拉刷新
```

---

## Phase 4: 跨模块关联修复

### Task 17: 购物车"编辑"模式 + 优惠码占位

**Files:**
- Modify: `src/app/cart.tsx`

**Step 1: 实现编辑模式**

- "编辑"按钮切换编辑状态
- 编辑模式下每个商品左侧出现选择框
- 底部出现"删除所选"按钮

**Step 2: 优惠码按钮占位**

- "使用"按钮 `onPress` → `Alert.alert('提示', '优惠码功能即将上线')`

**Step 3: Commit**
```
feat: 购物车编辑模式 + 优惠码占位提示
```

---

### Task 18: 结算页添加"新增地址"入口

**Files:**
- Modify: `src/app/checkout.tsx`

**Step 1: 无地址时显示添加入口**

- 当 `address` 为 undefined 时，显示 "添加收货地址" 卡片
- 点击跳转 `/addresses`

**Step 2: Commit**
```
fix: 结算页无地址时显示[添加收货地址]入口
```

---

### Task 19: 产品详情页补全 (库存显示 + 分享占位)

**Files:**
- Modify: `src/app/product/[id].tsx`

**Step 1: 显示库存**

- 在价格下方显示库存信息："库存充足" / "仅剩 X 件" / "已售罄"
- 已售罄时禁用"加入购物车"和"立即购买"

**Step 2: 分享按钮占位**

- 分享按钮 `onPress` → `Alert.alert('提示', '分享功能即将上线')`

**Step 3: Commit**
```
feat: 产品详情 — 库存显示 + 分享占位
```

---

### Task 20: 物流追踪页面对接真实订单数据

**Files:**
- Modify: `src/app/tracking.tsx`

**Step 1: 接收订单ID参数**

- 使用 `useLocalSearchParams` 接收 `orderId`
- 从 `useOrderStore.fetchOrderById(orderId)` 获取订单
- 物流时间线保留模拟数据（真实物流API后续接入），但包裹信息从订单数据读取

**Step 2: Commit**
```
fix: 物流追踪页面对接订单数据 (包裹信息动态化)
```

---

## 优先级与预估

| Phase | Tasks | 说明 |
|-------|-------|------|
| Phase 1 | Task 1-9 | 我的模块：退出登录 + 5个子页面 + 数据动态化 |
| Phase 2 | Task 10-14 | 首页：分类跳转 + 加购 + 购物车入口 + 刷新 |
| Phase 3 | Task 15-16 | 商城：排序 + 购物车入口 + 空状态 |
| Phase 4 | Task 17-20 | 跨模块：购物车编辑 + 结算 + 产品详情 + 物流 |

**暂不实现的子页面（低优先级，后续迭代）：**
- 优惠券页面（需后端支持）
- 冲泡记录页面（需新 store + 数据模型）
- 邀请好友页面（需分享/推荐码后端）
- 我的评价页面（需评价 store + 数据模型）
- 产品评价区域（需评论系统后端）

---
