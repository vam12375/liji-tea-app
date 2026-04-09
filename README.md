<div align="center">

<img src="./assets/images/liji-logo.png" alt="李记茶 Logo" width="96" />

#李记茶 · Liji Tea App

一款围绕茶饮零售、茶文化内容与茶友互动构建的移动端应用。  
基于 Expo / React Native / TypeScript / Supabase 打造，强调品牌气质、内容表达与移动端体验。

<p>
  <img src="https://img.shields.io/badge/Expo-SDK%2055-0F172A?logo=expo&logoColor=white" alt="Expo SDK 55" />
  <img src="https://img.shields.io/badge/React%20Native-0.83-61DAFB?logo=react&logoColor=white" alt="React Native 0.83" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.9"/>
  <img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Android-First-3DDC84?logo=android&logoColor=white" alt="Android First" />
  <img src="https://img.shields.io/badge/Status-Active%20Iteration-B88947" alt="Active Iteration" />
</p>

</div>

## 演示截图

<div align="center">
  <p>
    <img src="./assets/images/pages-1.jpg" alt="李记茶页面演示图 1" width="100%" />
  </p>
  <p>
    <img src="./assets/images/pages-2.jpg" alt="李记茶页面演示图 2" width="100%" />
  </p>
</div>

---

## 导航

- [项目概览](#项目概览)
- [核心特性](#核心特性)
- [架构一览](#架构一览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [常用命令](#常用命令)
- [测试与质量校验](#测试与质量校验)
- [Native 模块接入说明](#native-模块接入说明)
- [支付与登录联调说明](#支付与登录联调说明)
- [运行时诊断与排障](#运行时诊断与排障)
- [目录结构](#目录结构)
- [关键业务链路](#关键业务链路)
- [文档索引](#文档索引)
- [支付排障手册](#支付排障手册)
- [当前状态与注意事项](#当前状态与注意事项)

## 项目概览

`李记茶` 是一个以茶饮消费场景为核心的移动端 App 原型，面向以下几类体验：

- 商品浏览与茶品筛选
- 购物车、结算、订单与支付
-茶文化内容展示与文章阅读
- 社区互动与内容发现
- 用户中心、收藏、地址与资料维护
- 原生能力扩展，例如支付宝支付与阿里云一键登录

项目当前采用 `Expo Router` 组织页面路由，`Zustand` 管理客户端业务状态，`Supabase` 承担认证、数据库与 Edge Functions 能力，整体方向是一个更贴近真实业务的茶品牌 App，而不是简单的 UI Demo。

> [!NOTE]
> 当前仓库以 **Android 调试、原生模块接入和业务流程验证** 为重点。  
> 如果你要体验支付宝支付或阿里云一键登录，请优先使用 **Dev Client / 原生构建**，不要依赖 Expo Go。

## 核心特性

### 1. 品牌化首页体验

- 启动页、品牌标题与视觉风格围绕“东方茶品牌”展开
- 首页聚合推荐茶品、新品、节气故事与文化内容
- 购物车悬浮入口与首页内容联动，强化转化路径

### 2.商城主流程

- 分类浏览、搜索、筛选与排序
- 商品详情页支持产地、工艺、风味画像、冲泡指南等信息表达
- 购物车、订单摘要、配送方式与地址管理已串联

### 3. 账号与用户资产

- 邮箱注册 / 登录
- 个人资料编辑
- 地址簿与默认地址管理
- 收藏、会员等级、积分等用户态信息

### 4. 内容与社区

- 茶文化首页与文章详情
- 社区动态、帖子与内容卡片
- 礼赠、专题内容、扩展页能力

### 5.原生能力接入

- 支付宝沙箱支付链路
- 阿里云一键登录原生模块
- Expo Module 方式维护 Android 原生扩展

### 6. 面向真实业务的后端集成

- Supabase Auth 会话体系
-商品、订单、地址、收藏等数据读写
- Edge Functions 处理支付下单、支付状态查询、支付通知与一键登录验证

## 架构一览

```text
┌──────────────────────────────────────────────┐
│                Expo / React Native App       │
│                                              │
│  src/app            页面路由（Expo Router）  │
│  src/components     业务组件                 │
│  src/stores         Zustand 状态管理         │
│  src/hooks          业务流程封装             │
│  src/lib客户端服务层             │
└──────────────────────────────┬───────────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │                           │
                 ▼                           ▼
        Supabase ClientNative Modules
   Auth / Database / Functions    支付宝 / 一键登录 / SDK 桥接
                 │
                 ▼
        Supabase Edge Functions
   ali-login / alipay-create-order /
payment-order-status / alipay-notify
```

如果你从代码结构理解项目，可以把它看成三层：

1. `UI 层`：页面、组件、品牌视觉与交互反馈  
2. `业务层`：Store、Hook、支付与登录流程编排  
3. `基础设施层`：Supabase、原生模块、Expo 配置与构建链路

## 技术栈

### 前端与运行时

- `Expo 55`
- `React Native 0.83`
- `React19`
- `TypeScript 5.9`
- `expo-router`

### UI 与体验

- `NativeWind 5`
- `react-native-reanimated`
- `expo-image`
- `@expo-google-fonts/manrope`
- `@expo-google-fonts/noto-serif-sc`

### 状态与业务组织

- `Zustand`
- 自定义业务 Hook
- `@/*` 路径别名

### 后端与服务能力

- `Supabase Auth`
- `Supabase Database`
- `Supabase Edge Functions`

### 原生能力

- `expo-dev-client`
- 自定义 Expo Modules
-支付宝 Android SDK 接入
- 阿里云一键登录原生桥接

## 快速开始

### 环境要求

建议本地至少具备以下环境：

- Node.js `20+`
- npm `10+`
- Android Studio
- JDK `17`
- 可用的 Supabase 项目

如果你要调试原生能力，还需要：

- 支付宝沙箱账号与 SDK 资源
- 阿里云一键登录相关配置
- EAS 账号与构建环境（可选，但推荐）

### 1. 安装依赖

```bash
npm install
```

### 2.配置环境变量

将 `.env.example` 复制为 `.env`，然后至少补齐以下客户端变量：

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

支付、一键登录、服务端密钥等额外变量见下方 [环境变量](#环境变量) 章节与 `.env.example`。

### 3. 启动项目

如果你只是查看 UI 或普通页面流程：

```bash
npm run start
```

如果你要调试 Android 原生能力，优先使用：

```bash
npm run android
```

如果已经装好了 Dev Client，也可以使用：

```bash
npm run start:dev-client
```

### 4. Web 预览

```bash
npm run web
```

> [!TIP]
> `Expo Go` 适合快速看页面，但 **不适合**验证支付宝支付、一键登录等依赖原生模块的功能。

## 环境变量

### 必填的客户端变量

| 变量名 | 作用 | 是否必填 |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase 项目地址 | 是 |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |Supabase 前端公开 Key | 是 |

### 常见的客户端开关

| 变量名 | 作用 | 说明 |
| --- | --- | --- |
| `EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED` | 支付宝支付开关 | 前端是否展示 /启用入口 |
| `EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED` | 微信支付开关 | 当前默认关闭 |
| `EXPO_PUBLIC_PAYMENT_ENV` | 支付环境标记 | 例如 `sandbox` |

<details>
<summary>展开查看服务端 / 支付 / 原生扩展相关变量</summary>

| 变量名 | 作用 |
| --- | --- |
| `ALIPAY_APP_ID` | 支付宝应用 ID |
| `ALIPAY_PRIVATE_KEY` | 支付宝 RSA2 私钥，仅服务端保存 |
| `ALIPAY_PUBLIC_KEY` | 支付宝公钥 |
| `ALIPAY_GATEWAY` | 支付宝网关地址 |
| `ALIPAY_NOTIFY_URL` | 支付宝异步通知地址 |
| `ALIPAY_SELLER_ID` |商户 PID，可按环境配置 |
| `SUPABASE_URL` | Edge Functions 运行时使用 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端高权限 Key，仅服务端保存 |
| `SUPABASE_ANON_KEY` |某些服务端调试场景使用 |
| `ALI_APP_KEY` | 阿里云一键登录 AppKey |

</details>

> [!WARNING]
> 不要将 `SUPABASE_SERVICE_ROLE_KEY`、支付宝私钥、生产环境密钥直接写入客户端代码或提交到仓库。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run start` | 启动 Expo 开发服务 |
| `npm run start:dev-client` | 使用 Dev Client启动 |
| `npm run android` | 运行 Android 原生构建 |
| `npm run ios` | 运行 iOS 原生构建|
| `npm run web` | 启动 Web 预览 |
| `npm run test` | 运行单进程 TypeScript 测试套件 |
| `npm run typecheck` | 执行前端 TypeScript 类型检查 |
| `npm run typecheck:functions` | 执行 Supabase Functions 类型检查 |
| `npm run typecheck:all` | 执行全部 TypeScript 类型检查 |
| `npm run lint` | 执行 Expo Lint |
| `npm run check` |依次执行 lint、typecheck:all 与 test |
| `npm run prebuild:android` | 生成 Android 原生工程 |
| `npx eas build -p android --profile preview` | 构建 Android 测试包 |

##测试与质量校验

当前仓库已经补齐基础校验链路，适合在提交前做最小闭环验证：

```bash
npm run test
npm run typecheck
npm run lint
npm run check
```

说明：

- `npm run test` 基于 `tsx ./tests/run-tests.ts`，适合当前仓库的纯函数与可注入流程测试。
- `npm run check` 会串行执行 `lint + typecheck:all + test`，适合作为提交前自检命令。
- 当前已覆盖的重点包括：
  - 一键登录原生能力可用性判断
  - 订单关闭 RPC 响应归一化
  -待支付订单超时规则
  - 路由构造函数
  - 物流追踪纯函数
  - 支付流程状态机与 executor 分发

## Native 模块接入说明

### 1.为什么必须使用 Dev Client / 原生构建

以下能力依赖原生模块，**不能只靠 Expo Go 完整验证**：

- 支付宝 Android 支付
- 阿里云一键登录
- 自定义 Expo Modules桥接逻辑

建议优先使用以下任一方式：

1. `npm run android`
2. `npm run start:dev-client`
3. EAS Development Build / Preview Build

### 2. 支付宝模块接入

支付宝原生桥接位于：

- `modules/liji-alipay/`
- `src/lib/alipayNative.ts`

接入步骤：

1. 从支付宝开放平台下载官方 Android SDK AAR。
2. 将 AAR 放入 `modules/liji-alipay/android/libs/`。
3. 执行 `npm run prebuild:android`。
4.执行 `npm run android` 或使用 EAS Development Build。

补充说明：

- `modules/liji-alipay/android/libs/README.md` 中已经提供了 AAR 放置说明。
-当前桥接层通过反射方式检测 SDK，因此即使未放入 AAR，也可以先完成代码接线。
- 但若缺少 AAR，运行时会提示“未检测到支付宝 Android SDK”。

### 3. 一键登录模块接入

阿里云一键登录模块位于：

- `modules/ali-one-login/`
- `src/modules/ali-one-login.ts`
- `src/hooks/useOneClickLogin.ts`

联调时至少需要确认：

-Android 真机 / 模拟器环境满足运营商取号条件
- 原生模块已被 Dev Client 或原生包正确打入
- `ALI_APP_KEY` 与服务端配置一致
- `supabase/functions/ali-login` 可正常访问

## 支付与登录联调说明

### 1.支付链路

当前支付流程已经按“页面层 → 支付编排 → 服务端确认”分层：

1. `src/app/payment.tsx` 负责页面状态展示与用户交互。
2. `src/lib/paymentFlow.ts` 负责状态机推进、executor 分发、副作用收口。
3. `src/lib/alipay.ts` / `src/lib/payment.ts` 负责请求 Supabase Functions。
4. `supabase/functions/alipay-create-order`、`payment-order-status`、`alipay-notify` 负责服务端支付链路。

联调建议：

- 真正验证支付宝 App Pay 时，必须在 Android Dev Client / 原生包中进行。
- 若只是验证订单状态切换与页面流程，可先启用 mock 渠道。
- 页面最终展示应以服务端确认结果为准，而不是以 SDK 返回成功作为唯一依据。

### 2. Mock Payment 使用建议

当前项目保留了 Mock 支付通道，适合以下场景：

- UI 联调
- 非支付宝真机环境下的流程验证
-订单 / 物流状态联动验证
- 编写无需原生环境的自动化测试

你可以通过环境变量控制渠道展示与启用状态，例如：

- `EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED`
- `EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED`
- `EXPO_PUBLIC_PAYMENT_CARD_ENABLED`
- `EXPO_PUBLIC_PAYMENT_ENV`

其中：

- 非 `alipay` 渠道当前统一走 mock executor
- `payment.tsx` 与 `paymentFlow.ts` 已统一收口不同支付渠道的状态流转

### 3.一键登录联调建议

建议按以下顺序排查一键登录链路：

1. 先确认当前运行环境为 Android Dev Client / 原生包。
2. 再确认原生模块是否已正确打包进应用。
3. 检查 `ALI_APP_KEY`、运营商能力、设备网络环境是否满足要求。
4. 最后检查 `supabase/functions/ali-login` 返回结果与会话写入流程。

## 运行时诊断与排障

### 1. 启动时诊断

根布局 `src/app/_layout.tsx` 已在启动时接入：

- `logRuntimeDiagnostics()`
- `diagnoseAuthState()`（仅开发环境）

它们分别用于：

- 输出当前运行环境、支付渠道配置、原生模块可用性
- 检查当前 Supabase Session / JWT / getUser 状态

### 2.常见问题排查

#### 支付宝按钮可见，但无法拉起支付

优先检查：

1. 当前是否为 Android 环境
2. 当前是否为 Dev Client / 原生构建，而不是 Expo Go
3. `modules/liji-alipay/android/libs/` 下是否已放入官方 AAR
4. `EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED` 是否启用
5. 服务端 `alipay-create-order` 是否可正常返回支付单

#### 支付完成后页面未进入成功态

优先检查：

1. `payment-order-status`是否返回 `paid / success`
2. `alipay-notify` 是否正确回写订单支付状态
3. 是否只是 SDK 返回成功，但服务端仍未确认
4. 控制台中的 `payment_started / payment_failed / payment_succeeded` 埋点输出

#### 登录态异常或 Session丢失

优先检查：

1. `src/lib/authDiagnostics.ts` 输出的 Session 状态
2. `src/lib/runtimeDiagnostics.ts` 输出的运行环境信息
3. `.env` 中 Supabase URL / Key 是否正确
4. `_layout.tsx` 是否已完成会话恢复与用户初始化

## 目录结构

```text
.
├─ assets/                      静态资源、品牌图标、启动图
├─ docs/                        方案文档、打包说明、安全审查
├─ modules/
│  ├─ali-one-login/            阿里云一键登录 Expo Module
│  └─ liji-alipay/              支付宝 Android 原生模块
├─ src/
│  ├─ app/                      页面与路由（Expo Router）
│  │  ├─(tabs)/                首页 / 商城 / 文化 / 社区 / 我的
│  │  ├─ product/[id].tsx       商品详情
│  │  ├─ article/[id].tsx       文章详情
│  │├─ post/[id].tsx          社区详情
│  │  ├─ cart.tsx               购物车
│  │  ├─ checkout.tsx           结算页
│  │  ├─payment.tsx            支付页
│  │  ├─ orders.tsx             订单列表
│  │  └─ login.tsx              登录 / 注册 / 一键登录
│  ├─ components/               业务 UI 组件
│  ├─constants/                颜色与主题常量
│  ├─ data/                     本地演示数据与内容数据
│  ├─ hooks/                    业务 Hook
│  ├─ lib/                      Supabase / 支付 / 原生桥接封装
│  ├─stores/                   Zustand 状态管理
│  └─ types/                    业务类型定义
├─ supabase/
│  └─ functions/                Edge Functions
├─ app.json                     Expo 应用配置
├─eas.json                     EAS 构建配置
├─ package.json                 脚本与依赖定义
└─ README.md
```

##关键业务链路

### 1.商品与商城

- `productStore` 负责商品拉取、搜索、单品读取与局部更新
- 首页与商城页共享商品数据源
- 商品详情页延展出风味、产地、冲泡与工艺信息

### 2. 用户与身份

- `userStore` 统一管理会话、资料、地址、收藏等用户资产
- 普通登录基于 `Supabase Auth`
-一键登录通过原生模块取号，再由 `supabase/functions/ali-login` 校验并回写会话

### 3. 订单与支付

- 订单创建由客户端流程驱动
- 支付宝支付通过 `alipay-create-order` 生成支付单
- 客户端原生模块拉起支付宝 SDK
- 通过 `payment-order-status` 轮询与 `alipay-notify` 回调确认支付结果

### 4. 内容与社区

- 文化页承载文章、专题与节气内容
- 社区页承载帖子、动态和用户内容展示
- 内容模块与电商模块相互导流，形成“内容 + 商品”的组合体验

### 5. 原生扩展能力

- `modules/ali-one-login` 负责阿里云一键登录桥接
- `modules/liji-alipay` 负责支付宝 Android 支付桥接
- 若需要完整验证，通常需要 `prebuild` 或 Dev Client / EAS Development Build

## 文档索引

- [安卓 APK 打包说明](./docs/打包.md)
- [安全审查报告](./docs/安全.MD)
- [支付链路与运行时排障手册](./docs/payment-and-runtime-troubleshooting.md)
- [完整开发指南](./docs/plans/2026-03-20-liji-tea-app-development-guide.md)
- [阿里云一键登录设计](./docs/plans/2026-03-23-ali-one-click-login-design.md)
- [支付宝沙箱接入实现计划](./docs/plans/2026-03-23-alipay-sandbox-implementation.md)
- [支付宝沙箱 App Pay 设计稿](./docs/superpowers/specs/2026-03-23-alipay-sandbox-app-pay-design.md)

## 支付排障手册

如果你正在联调支付、排查订单状态异常、确认 notify 回写或检查环境变量配置，建议优先阅读：

- [支付链路与运行时排障手册](./docs/payment-and-runtime-troubleshooting.md)

文档中包含：

- 当前支付链路分层说明
- 订单 / 支付 / notify 的推荐排查顺序
- `orders` / `payment_transactions` 的关键字段排查建议
-环境变量清单
- 发布前最小核对清单

## 当前状态与注意事项

###当前已落地的方向

- 首页、商城、文化、社区、个人中心等主 Tab 结构已成型
- 商品详情、购物车、结算、订单、支付页已串联
- Supabase 登录、资料、地址、收藏等基础用户体系已接入
- 阿里云一键登录与支付宝沙箱支付已进入原生能力接入阶段
- 订单域已完成 store拆分、状态细化、列表与履约页重构
- 支付链路已完成状态机化、executor 化与日志埋点接入
- 根布局已接入运行时诊断、认证诊断与幂等初始化保护
- 基础测试链路、`npm run test`、`npm run check` 已可用

### 当前更适合的使用场景

- 业务原型展示
- 交互与视觉验证
- Expo + Supabase + 原生模块集成实践
-茶饮电商 App 的架构参考

### 正式上线前建议补齐

- 服务端计价与订单可信边界
- RLS / Migration / 权限策略落库
- 支付成功状态完全服务端收口
- 更完善的错误处理、测试与发布流程
- 支付异常链路的集成测试与回放脚本

> [!IMPORTANT]
> 仓库内已经保留安全审查文档。  
>如果你要将本项目推进到生产环境，请先阅读 [安全审查报告](./docs/安全.MD)，再继续做支付、订单与权限相关工作。

## 补充说明

- 本项目使用 `src/app` 作为 Expo Router 路由根目录，搭配 `@/*` 路径别名组织代码
-若调试支付宝 Android 支付，需要将官方 AAR 文件放入 `modules/liji-alipay/android/libs/`
-若缺少支付宝 AAR，代码仍可完成接线，但运行时会提示未检测到 SDK
-数据库 migration 与权限策略说明
-自动化测试与发布流程
