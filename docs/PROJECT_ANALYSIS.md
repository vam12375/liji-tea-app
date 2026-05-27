# 李记茶 (liji-tea-app) 项目全面分析报告

## 一、项目概览

| 项目属性 | 值 |
|---------|-----|
| **项目名称** | 李记茶 (liji-tea-app) |
| **版本** | 4.0.0 |
| **项目类型** | 茶饮零售+茶文化内容+社区互动的移动端 App |
| **技术栈** | Expo SDK 55 / React Native 0.83 / React 19 / TypeScript 5.9 |
| **后端** | Supabase (Auth + Database + Edge Functions) |
| **UI 框架** | NativeWind 5 (TailwindCSS for RN) + Reanimated |
| **状态管理** | Zustand |
| **路由** | Expo Router (基于文件系统路由) |
| **构建/发布** | EAS Build (Expo Application Services) |
| **包管理** | npm (package-lock.json 存在) |
| **目标平台** | Android First (兼顾 iOS / Web) |

---

## 二、技术栈详情

### 2.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Expo** | SDK 55 | 开发框架和工具链 |
| **React Native** | 0.83.4 | 移动端 UI 框架 |
| **React** | 19.2.0 | UI 库 |
| **TypeScript** | 5.9.2 | 类型安全 |
| **NativeWind** | 5.0.0-preview.3 | TailwindCSS for RN |
| **TailwindCSS** | 4.2.2 | CSS 工具类 |
| **Zustand** | 5.0.12 | 状态管理 |
| **Expo Router** | 55.0.8 | 文件系统路由 |
| **React Navigation** | 7.x | 导航库 |
| **React Native Reanimated** | 4.2.1 | 动画库 |
| **React Native Gesture Handler** | 2.30.0 | 手势处理 |
| **React Native Screens** | 4.23.0 | 原生屏幕优化 |

### 2.2 后端技术栈

| 技术 | 用途 |
|------|------|
| **Supabase** | BaaS 平台 (Auth + Database + Edge Functions) |
| **PostgreSQL** | 数据库 (通过 Supabase) |
| **Edge Functions** | 服务端逻辑 (Deno 运行时) |
| **Row Level Security (RLS)** | 数据安全策略 |

### 2.3 开发工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| **ESLint** | 9.x | 代码质量 |
| **Prettier** | - | 代码格式化 |
| **tsx** | 4.21.0 | TypeScript 运行器 |
| **EAS Build** | >= 15.0.0 | 云端构建和发布 |
| **GitHub Actions** | - | CI/CD 流水线 |

---

## 三、项目架构

### 3.1 整体架构模式

采用 **四层分层架构** + **业务域分组**：

```
┌─────────────────────────────────────────────────────────────┐
│  路由层 (app/)        — Expo Router 文件系统路由，页面编排     │
├─────────────────────────────────────────────────────────────┤
│  UI 层 (components/)  — 按业务域分组的可复用 React 组件        │
├─────────────────────────────────────────────────────────────┤
│  状态层 (stores/)     — Zustand stores，全局状态管理           │
├─────────────────────────────────────────────────────────────┤
│  服务层 (lib/)        — 业务逻辑、API 调用、纯函数工具         │
├─────────────────────────────────────────────────────────────┤
│  基础层 (types/ + constants/ + data/ + hooks/ + modules/)    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 目录结构

```
liji-tea-app/
├── app/                    # Expo Router 文件系统路由
│   ├── (tabs)/            # Tab 导航组 (首页/商城/社区/我的)
│   ├── merchant/          # 商家后台 (独立 Stack 导航)
│   ├── product/           # 商品详情
│   ├── community/         # 社区功能
│   └── ...                # 其他页面
├── src/
│   ├── components/        # 按业务域分组的 UI 组件
│   ├── stores/            # Zustand stores (32 个文件)
│   ├── lib/               # 业务逻辑和工具函数 (56 个文件)
│   ├── hooks/             # 自定义 Hooks (9 个文件)
│   ├── data/              # 静态数据
│   ├── constants/         # 全局常量
│   ├── types/             # TypeScript 类型定义
│   └── modules/           # 原生模块桥接
├── android/               # Android 原生工程
├── supabase/              # Supabase 后端配置
│   ├── migrations/        # 数据库迁移 (34 个文件)
│   └── functions/         # Edge Functions (17 个)
├── tests/                 # 测试文件 (30 个测试套件)
├── scripts/               # 自动化脚本
└── assets/                # 静态资源
```

---

## 四、核心功能模块

### 4.1 C 端用户功能

| 功能模块 | 主要页面 | 核心组件 |
|---------|---------|---------|
| **首页** | 首页、茶文化页 | TopAppBar, HeroBanner, CategoryRow, FeaturedProducts |
| **商城** | 商城页、商品详情、搜索 | SearchBar, FilterChips, ShopProductCard, ProductCard |
| **购物车** | 购物车页、结算页、支付页 | CartItemCard, OrderSummary, AddressCard, PaymentMethods |
| **订单** | 订单列表、物流追踪 | OrderStatusBadge, PaymentCountdown, TrackingTimeline |
| **社区** | 社区页、帖子详情、发帖 | PostCard, CommunityTabs, StoryRow |
| **个人中心** | 个人中心、设置、收藏 | MemberHeader, StatsGrid, MenuList |

### 4.2 B 端商家功能

| 功能模块 | 主要页面 | 核心组件 |
|---------|---------|---------|
| **工作台** | 商家首页、数据统计 | MerchantHeroStats, MerchantBentoBlock |
| **订单管理** | 订单列表、订单详情 | MerchantOrderCard, MerchantOrderFilterBar |
| **商品管理** | 商品列表、商品详情 | MerchantProductCard, StockAdjustPanel |
| **售后管理** | 售后列表、售后详情 | MerchantAfterSaleCard, AfterSaleActionSheet |
| **员工管理** | 员工列表、权限管理 | MerchantEntryCard |

---

## 五、状态管理架构

### 5.1 Zustand Store 设计模式

采用 **"入口组装器 + actions 拆分模块"** 模式：

```
userStore.ts             ← 入口：定义 State 接口 + 组装 actions
├── userStore.auth.ts    ← 认证相关 actions
├── userStore.profile.ts ← 资料 actions
├── userStore.addresses.ts ← 地址 actions
├── userStore.favorites.ts ← 收藏 actions
├── userStore.role.ts    ← 角色 actions
├── userStore.shared.ts  ← 共享类型
└── userStore.utils.ts   ← 工具函数
```

### 5.2 核心 Stores

| Store | 职责 | 特点 |
|-------|------|------|
| **userStore** | 用户认证、资料、地址、收藏、角色 | 模块化拆分，7 个子文件 |
| **cartStore** | 购物车状态 | AsyncStorage 持久化 |
| **orderStore** | 订单管理 | 包含订单查询和操作 |
| **productStore** | 商品数据 | 缓存和分页 |
| **communityStore** | 社区功能 | 帖子、故事、互动 |
| **couponStore** | 优惠券 | 幂等守卫、缓存逻辑 |
| **merchantStore** | 商家端 | 独立的商家数据管理 |
| **modalStore** | 全局弹窗 | 单 slot 策略 |
| **toastStore** | 全局 Toast | 双主题（customer/merchant） |

---

## 六、数据层架构

### 6.1 Supabase 集成

- **客户端初始化**：`lib/supabase.ts` 配置自动 Token 刷新
- **RPC 调用**：通过 Edge Functions 调用数据库函数
- **实时订阅**：支持实时数据更新

### 6.2 数据库表结构

| 域 | 主要表 | 用途 |
|-----|--------|------|
| **用户** | profiles, addresses, user_roles | 用户信息和权限 |
| **商品** | products, product_reviews | 商品和评价 |
| **订单** | orders, order_items, payment_transactions | 订单和支付 |
| **社区** | posts, stories, post_comments, post_likes | 社区内容 |
| **优惠券** | coupons, user_coupons | 优惠券系统 |
| **售后** | after_sale_requests, after_sale_evidences | 售后服务 |
| **推送** | push_devices, push_dispatch_queue | 推送通知 |
| **积分** | point_tasks, point_ledger, user_point_task_records | 会员积分 |

### 6.3 Edge Functions

| 函数 | 功能 | 安全特性 |
|------|------|---------|
| **create-order** | 创建订单 | 服务端计价、限流 |
| **alipay-create-order** | 创建支付宝支付单 | 私钥服务端持有 |
| **alipay-notify** | 支付宝异步回调 | 验签、幂等处理 |
| **cancel-order** | 取消订单 | 权限校验、库存释放 |
| **claim-coupon** | 领取优惠券 | 原子性操作、防超领 |
| **dispatch-push-queue** | 推送分发 | Secret 鉴权 |

---

## 七、安全架构

### 7.1 前端安全

- **环境变量**：仅 `EXPO_PUBLIC_` 前缀变量暴露给客户端
- **敏感信息**：支付宝私钥、Supabase Service Role Key 仅限服务端
- **Token 存储**：使用 `expo-secure-store` 安全存储

### 7.2 后端安全

- **Row Level Security (RLS)**：所有业务表启用 RLS
- **权限收敛**：订单/支付域客户端禁止直接写入
- **限流机制**：登录/匿名用户固定窗口限流
- **输入验证**：Edge Functions 参数校验
- **审计日志**：商家端操作全量记录

### 7.3 CI/CD 安全

- **Secret 扫描**：Gitleaks 全历史扫描
- **依赖审计**：npm audit critical 级别阻断
- **最小权限**：GitHub Actions 仅授予必要权限

---

## 八、测试架构

### 8.1 测试策略

- **测试框架**：自研轻量框架（Node.js assert + tsx）
- **测试类型**：纯函数单元测试为主
- **测试数量**：30 个测试套件，约 142 个测试用例
- **覆盖范围**：售后、支付、订单、商家端、用户、搜索、社区、推送、埋点

### 8.2 CI/CD 流水线

```
PR 阶段（质量门禁）
├── check.yml          → lint + typecheck + test + secret扫描 + 依赖审计
├── migrations.yml     → supabase db push --dry-run
└── eas-build.yml      → 打 build-apk label → 出 APK

merge 到 master（自动部署）
├── deploy-functions.yml → 部署变更的 Edge Functions → staging
└── migrations.yml       → supabase db push → staging

打 Release Tag（生产部署）
└── deploy-functions.yml → 部署全部 Edge Functions → production
```

---

## 九、设计系统

### 9.1 品牌设计 "The Ethereal Steep"

- **主色调**：茶叶深绿 `#435c3c`
- **辅助色**：大地棕 `#715b3e`
- **强调色**：学士金 `#6c521d`
- **表面色**：温暖奶油色系 `#fef9f1`
- **标题字体**：思源宋体 (Noto Serif SC)
- **正文字体**：Manrope
- **色彩规范**：Material Design 3 完整色阶

### 9.2 双色板体系

- **C 端**：`constants/Colors.ts` — 茶主题设计系统
- **B 端**：`constants/MerchantColors.ts` — Ink/Paper 语义色板

---

## 十、性能优化

### 10.1 前端优化

- **Hermes 引擎**：启用 Hermes JS 引擎提升性能
- **新架构**：启用 Fabric + TurboModules
- **图片优化**：expo-image 组件，支持 WebP
- **动画优化**：React Native Reanimated 4.2.1

### 10.2 后端优化

- **聚合计数**：帖子/评论计数由触发器维护
- **行级锁**：商品库存使用 SELECT FOR UPDATE 防超卖
- **原子性 RPC**：关键操作使用数据库事务函数
- **索引优化**：复合索引覆盖高频查询路径
- **TTL 清理**：审计日志、限流记录自动清理

---

## 十一、已知问题和改进建议

### 11.1 高优先级

1. **Release 签名使用 debug 密钥**：需要配置正式签名
2. **缺少 XML 备份规则文件**：需要创建或重新执行 prebuild
3. **支付宝 AAR 缺失**：需要下载并放入 libs 目录
4. **测试覆盖率统计**：建议引入 c8 或 istanbul

### 11.2 中优先级

1. **lib/ 目录过于扁平**：建议按业务域进一步分组
2. **data/ 目录定位模糊**：可考虑合并到 constants/ 或 types/
3. **集成测试落地**：将文档化的方案实现为可执行测试
4. **组件测试**：考虑引入 @testing-library/react-native

### 11.3 低优先级

1. **原生模块层过薄**：建议建立更结构化的桥接层
2. **部分 Store 缺少模块化拆分**：可参考 userStore 模式重构
3. **测试并行执行**：当前串行执行，可优化为并行

---

## 十二、总结

这是一个**架构设计成熟、工程化程度高**的 React Native 电商应用，具有以下特点：

1. **清晰的分层架构**：四层架构 + 业务域分组，代码组织清晰
2. **完整的状态管理**：Zustand 模块化 Store 设计，可维护性强
3. **安全优先**：全量 RLS + 服务端收口 + 限流机制
4. **可观测性**：完整的日志、监控、诊断体系
5. **双端合一**：C 端 + B 端统一代码库，权限守卫前置
6. **务实测试**：纯函数单元测试 + 文档化集成测试方案
7. **自动化 CI/CD**：4 个 GitHub Actions workflow 覆盖完整流水线

项目在工程化方面投入了大量精力，代码组织方式体现了对 KISS、YAGNI、SOLID 原则的良好实践，适合当前阶段的团队规模和产品复杂度。
