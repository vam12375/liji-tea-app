# Supabase 对接设计方案

> 日期：2026-03-21
> 状态：已确认
> 架构方案：方案 A — 轻量直连（Zustand Store 直接调用 Supabase Client）

---

## 1. 概述

将 liji-tea-app 从 100% 硬编码 mock 数据迁移到 Supabase 后端，涵盖：
- **Auth**：邮箱 + 密码登录/注册（微信 OAuth 后续追加）
- **Database**：核心模块（Products + Profiles + Orders + Addresses + Favorites）
- **Storage**：所有图片迁移到 Supabase Storage
- **Realtime**：订单状态 + 商品库存实时同步

### 架构图

```
组件 → Zustand Store → supabase client → Supabase 后端
                                         ├── Auth
                                         ├── PostgreSQL (RLS)
                                         ├── Storage (Buckets)
                                         └── Realtime (WebSocket)
```

---

## 2. 客户端初始化

### 环境变量（`.env`）
```
EXPO_PUBLIC_SUPABASE_URL=<project-url>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

### 客户端单例（`src/lib/supabase.ts`）
- 使用 `expo-sqlite/localStorage` polyfill 做 session 持久化
- `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`
- 根 `_layout.tsx` 中注册 AppState 监听：前台自动刷新 token，后台停止刷新

---

## 3. 数据库表设计

### 3.1 `profiles` — 用户资料
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK, FK → auth.users) | 用户 ID |
| name | text | 昵称 |
| phone | text | 手机号 |
| avatar_url | text | 头像 URL |
| member_tier | text | 会员等级，默认 '新叶会员' |
| points | integer | 积分，默认 0 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

- Trigger：用户注册时自动创建 profile
- RLS：用户只能读写自己的资料

### 3.2 `addresses` — 收货地址
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 地址 ID |
| user_id | uuid (FK → profiles) | 所属用户 |
| name | text | 收件人 |
| phone | text | 电话 |
| address | text | 详细地址 |
| is_default | boolean | 是否默认 |
| created_at | timestamptz | 创建时间 |

### 3.3 `products` — 商品
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 商品 ID |
| name | text | 商品名称 |
| origin | text | 产地 |
| price | numeric(10,2) | 价格 |
| unit | text | 规格，默认 '50g' |
| image_url | text | 图片 URL |
| description | text | 描述 |
| is_new | boolean | 是否新品 |
| category | text | 分类 |
| tagline | text | 标语 |
| tasting_profile | jsonb | 口感数据数组 |
| brewing_guide | jsonb | 冲泡指南 |
| origin_story | text | 产地故事 |
| process | jsonb | 制作工序（字符串数组） |
| stock | integer | 库存，默认 100 |
| is_active | boolean | 是否上架 |
| created_at | timestamptz | 创建时间 |

- RLS：所有人可读，仅管理员可写

### 3.4 `favorites` — 用户收藏
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid (PK, FK → profiles) | 用户 ID |
| product_id | uuid (PK, FK → products) | 商品 ID |
| created_at | timestamptz | 收藏时间 |

### 3.5 `orders` — 订单
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 订单 ID |
| user_id | uuid (FK → profiles) | 用户 ID |
| address_id | uuid (FK → addresses) | 收货地址 |
| status | text | 状态：pending/paid/shipping/delivered/cancelled |
| total | numeric(10,2) | 总金额 |
| delivery_type | text | 配送方式 |
| payment_method | text | 支付方式 |
| notes | text | 备注 |
| gift_wrap | boolean | 是否礼盒包装 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 3.6 `order_items` — 订单明细
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 明细 ID |
| order_id | uuid (FK → orders) | 订单 ID |
| product_id | uuid (FK → products) | 商品 ID |
| quantity | integer | 数量 |
| unit_price | numeric(10,2) | 单价 |

---

## 4. Storage Buckets

| Bucket | 访问权限 | 用途 |
|--------|---------|------|
| `product-images` | public 可读 | 商品图 |
| `avatars` | public 可读, authenticated 写自己的 | 用户头像 |

- 第一阶段通过 Dashboard 手动上传 6 张产品图
- 产品表 `image_url` 存储完整公开 URL

---

## 5. 认证流程

### 第一阶段：邮箱 + 密码
- 注册：`supabase.auth.signUp({ email, password })`
- 登录：`supabase.auth.signInWithPassword({ email, password })`
- 新增 `src/app/login.tsx` 登录/注册页面

### 后续：微信 OAuth
- Supabase 不原生支持微信 provider
- 需自定义 Edge Function 实现，作为独立后续任务

### 路由保护
- 需登录：cart, checkout, profile
- 无需登录：首页, 商城, 商品详情, 茶道, 社区, 搜索

---

## 6. 状态管理改造

### `userStore.ts` 改造
- 移除 mock login/logout
- 新增：session, profile 状态
- 新增：signUp, signIn, signOut, fetchProfile, updateProfile 方法
- 根 `_layout.tsx` 监听 `onAuthStateChange`

### 新增 `productStore.ts`
- fetchProducts, fetchProductById, searchProducts
- 替换 `src/data/products.ts` 硬编码

### `cartStore.ts` 改造
- 购物车仍用本地存储
- 下单时才提交到 Supabase（创建 order + order_items）

### 新增 `orderStore.ts`
- createOrder, fetchOrders, fetchOrderById

---

## 7. 实时订阅

### 订单状态实时更新
- 在 tracking 页和 profile 页启用
- 监听 `orders` 表 UPDATE 事件，过滤当前用户

### 商品库存实时同步
- 在商品详情页启用
- 监听 `products` 表 UPDATE 事件，过滤当前商品

---

## 8. 文件变更清单

### 新增文件（7 个）
- `.env` — 环境变量
- `src/lib/supabase.ts` — 客户端单例
- `src/stores/productStore.ts` — 商品状态管理
- `src/stores/orderStore.ts` — 订单状态管理
- `src/app/login.tsx` — 登录/注册页面
- `src/types/database.ts` — Supabase 表类型定义
- `supabase/seed.sql` — 种子数据脚本

### 修改文件（约 12 个）
- `src/app/_layout.tsx` — Auth 状态监听 + AppState 刷新
- `src/stores/userStore.ts` — 对接 Supabase Auth
- `src/stores/cartStore.ts` — 下单时提交到 Supabase
- `src/app/(tabs)/index.tsx` — 从 productStore 读取
- `src/app/(tabs)/shop.tsx` — 从 productStore 读取
- `src/app/(tabs)/profile.tsx` — 对接真实用户数据
- `src/app/product/[id].tsx` — 从 productStore 读取 + 实时库存
- `src/app/cart.tsx` — 检查登录状态
- `src/app/checkout.tsx` — 创建真实订单
- `src/app/tracking.tsx` — 实时订单状态订阅
- `src/components/home/*.tsx` — 数据源从 mock → store
- `package.json` — 新增依赖

### 新增依赖
- `@supabase/supabase-js`
- `expo-sqlite`（session 持久化）
- `expo-secure-store`（可选，未来加密用）
