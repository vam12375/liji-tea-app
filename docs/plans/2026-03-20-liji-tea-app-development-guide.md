# 李记茶 APP — 完整开发指南

> 目标：Android 单端 | 开发者背景：全栈（熟悉 React/Next.js/TypeScript）

---

## 一、技术方案对比分析

### 你有 5 条路可以走

| 方案 | 框架 | 开发工具 | 语言 | 学习成本 | 性能 | 生态 |
|------|------|----------|------|----------|------|------|
| **A. React Native + Expo** | React Native | **VSCode** | TypeScript | ★☆☆☆☆ 极低 | ★★★★☆ | 成熟 |
| **B. Flutter** | Flutter | **VSCode** / Android Studio | Dart | ★★★☆☆ 中等 | ★★★★★ | 成熟 |
| **C. UniApp** | Vue 语法 | **HBuilderX** | Vue/JS | ★★☆☆☆ 低 | ★★★☆☆ | 中国生态强 |
| **D. Kotlin 原生** | Jetpack Compose | **Android Studio** | Kotlin | ★★★★☆ 高 | ★★★★★ | 官方 |
| **E. Taro / 跨端** | React 语法 | **VSCode** | TypeScript | ★★☆☆☆ 低 | ★★★☆☆ | 小程序优先 |

---

### 方案 A：React Native + Expo ⭐ 推荐

```
为什么推荐：你已经熟悉 React + TypeScript + Next.js，迁移成本几乎为零
```

**优势：**
- 你现有的 React/TS 技能直接复用，组件思维完全一样
- Expo 提供开箱即用的工具链 — 构建、调试、热更新、推送通知全包
- 可以复用你网站项目中的数据模型（`products.ts`）、类型定义、业务逻辑
- 动画方面 `react-native-reanimated` 媲美原生流畅度
- 社区庞大，npm 生态直接可用
- 一套代码未来可扩展到 iOS（虽然你现在只做 Android）

**劣势：**
- 极其复杂的原生功能（如 AR 识茶）需要写原生模块桥接
- 包体积比原生稍大（~15MB 基础）
- 极端性能场景（如 3D 渲染）不如原生

**开发工具：VSCode** + Expo CLI + Android 模拟器/真机

**关键依赖：**
```
expo                         # 开发框架
react-native                 # 运行时
expo-router                  # 文件式路由（类似 Next.js App Router）
react-native-reanimated      # 高性能动画（替代你网站的 GSAP）
nativewind                   # Tailwind CSS for RN（你熟悉的样式方式）
@react-navigation/native     # 导航（底部 Tab 等）
expo-camera                  # AR 识茶的相机模块
expo-image                   # 高性能图片加载
zustand / jotai              # 状态管理
react-query                  # 服务端数据缓存
```

---

### 方案 B：Flutter

**优势：**
- 性能最强的跨端方案，自绘引擎，动画极度流畅
- Material Design 3 原生支持（你选了 Android 优先，天然契合）
- 一套代码 → Android/iOS/Web/桌面 全平台
- Google 亲儿子，和 Android 生态深度集成

**劣势：**
- 需要学 Dart 语言（语法类似 TS，但还是新语言）
- 你现有的 React/TS 代码无法复用
- 中文社区不如 React Native 活跃
- 热更新能力弱（国内审核场景下是痛点）

**开发工具：VSCode**（装 Flutter 插件）或 **Android Studio**

**适合你的场景：** 如果你愿意投入 1-2 周学 Dart，且特别在意动画流畅度

---

### 方案 C：UniApp (HBuilderX)

**优势：**
- 一套代码 → Android/iOS/微信小程序/H5 全端
- HBuilderX 是专用 IDE，开箱即用，中文文档
- 对中国市场特别友好（微信支付、支付宝、各种国内 SDK）
- 社区插件市场有大量现成组件
- 打包简单，云端打包免配置 Android 环境

**劣势：**
- 基于 WebView 的渲染（性能不如 RN/Flutter）
- 复杂动画和交互体验有上限，做不到你网站那种丝滑动效
- 你需要从 React 切换到 Vue 语法（虽然 UniApp 也支持 Vue3 + TS）
- 定制化受限，深层原生功能依赖插件市场质量
- **你是全栈开发者，HBuilderX 的能力上限可能会限制你**

**开发工具：HBuilderX**（专用 IDE，不能用 VSCode）

**适合场景：** 需要同时出小程序 + APP，或者追求最快出包速度

---

### 方案 D：Kotlin + Jetpack Compose 原生

**优势：**
- Android 官方推荐方案，性能和体验天花板
- Jetpack Compose 声明式 UI（和 React 思维类似）
- 完美支持 Material Design 3
- 所有 Android 功能无限制访问（AR、相机、传感器等）
- 包体积最小

**劣势：**
- 需要学 Kotlin（虽然语法现代，仍有学习曲线）
- 只能做 Android，无法扩展到 iOS
- 开发效率不如跨端方案
- 后端/前端代码完全无法复用

**开发工具：Android Studio**（必须）

**适合场景：** 追求极致 Android 体验，不考虑其他平台

---

### 方案 E：Taro

**说明：** Taro 主要面向小程序生态（微信/支付宝/抖音），虽然支持 React Native 输出，但 APP 体验不如直接用 RN。你只做 Android APP 的话，**不推荐 Taro**。

---

## 二、最终推荐

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   推荐方案：React Native + Expo + VSCode            │
│                                                     │
│   理由：                                            │
│   1. 你的 React/TS 技能直接复用，学习成本最低        │
│   2. expo-router 文件式路由和 Next.js App Router     │
│      几乎一样的开发体验                              │
│   3. NativeWind 让你继续用 Tailwind 写样式           │
│   4. 动画能力足够实现你设计稿中的所有效果             │
│   5. 未来想扩展 iOS 随时可以，零额外成本              │
│                                                     │
│   次选：Flutter（如果你愿意学 Dart）                 │
│   不推荐：UniApp（性能上限低，HBuilderX 限制多）     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 三、开发环境搭建

### 你需要安装的软件

| 软件 | 用途 | 下载 |
|------|------|------|
| **VSCode** | 主编辑器 | code.visualstudio.com |
| **Node.js 20 LTS** | JS 运行时 | nodejs.org |
| **Android Studio** | Android SDK + 模拟器 | developer.android.com/studio |
| **JDK 17** | Android 构建依赖 | adoptium.net |
| **Git** | 版本控制 | 你已有 |

### VSCode 必装插件

```
- ES7+ React/React Native Snippets    # RN 代码片段
- React Native Tools                   # 调试支持
- Tailwind CSS IntelliSense            # NativeWind 样式提示
- ESLint                               # 代码规范
- Prettier                             # 格式化
- Error Lens                           # 行内错误提示
- GitHub Copilot / Claude              # AI 辅助
```

### 环境初始化步骤

```bash
# 1. 安装 Expo CLI
npm install -g expo-cli

# 2. 创建项目（使用 expo-router 模板）
npx create-expo-app liji-tea-app --template tabs

# 3. 安装核心依赖
cd liji-tea-app
npx expo install nativewind tailwindcss   # Tailwind 支持
npx expo install react-native-reanimated  # 动画引擎
npx expo install expo-image               # 图片优化
npx expo install expo-camera              # AR 相机
npx expo install @react-navigation/native @react-navigation/bottom-tabs

# 4. 启动开发服务器
npx expo start

# 5. 在 Android 模拟器或真机上运行
# 按 'a' 键在 Android 模拟器启动
# 或手机安装 Expo Go APP 扫码调试
```

---

## 四、完整开发流程（从零到上架）

### 全流程路线图

```
阶段 1          阶段 2          阶段 3          阶段 4          阶段 5
需求与设计 ───→ 环境搭建 ───→ 核心开发 ───→ 测试与优化 ───→ 打包上架
(1-2周)        (1-2天)        (6-10周)       (2-3周)        (1-2周)
   │              │              │              │              │
   ▼              ▼              ▼              ▼              ▼
 原型设计      装软件/配置    写代码/调UI     真机测试       签名/打包
 交互流程      创建项目       接后端API      性能优化       应用商店
 数据模型      目录结构       动画/交互      Bug修复        审核上架
 (已完成✅)    跑通Hello      单元测试       兼容性测试      版本管理
```

---

### 阶段 1：需求与设计 ✅ 已完成

- [x] 确定 APP 定位（融合型电商+品牌体验）
- [x] 设计原型（Google Stitch 提示词已生成）
- [x] 定义数据模型（products.ts 可复用）
- [x] 设计系统（配色/字体/组件规范已有）

---

### 阶段 2：环境搭建与项目初始化（1-2 天）

**任务清单：**

1. **安装开发工具**（见上方表格）

2. **配置 Android 开发环境**
   ```
   Android Studio → SDK Manager → 安装：
   - Android 14 (API 34) SDK
   - Android SDK Build-Tools
   - Android Emulator
   - Android SDK Platform-Tools
   
   配置环境变量：
   ANDROID_HOME = C:\Users\<你>\AppData\Local\Android\Sdk
   PATH += %ANDROID_HOME%\platform-tools
   ```

3. **创建项目并确立目录结构**
   ```
   liji-tea-app/
   ├── app/                    # Expo Router 页面（类似 Next.js app/）
   │   ├── (tabs)/             # 底部 Tab 布局组
   │   │   ├── _layout.tsx     # Tab 导航配置
   │   │   ├── index.tsx       # 首页 Tab
   │   │   ├── shop.tsx        # 商城 Tab
   │   │   ├── culture.tsx     # 茶道 Tab
   │   │   ├── community.tsx   # 社区 Tab
   │   │   └── profile.tsx     # 我的 Tab
   │   ├── product/
   │   │   └── [id].tsx        # 茶品详情（动态路由）
   │   ├── cart.tsx            # 购物车
   │   ├── checkout.tsx        # 结算
   │   ├── search.tsx          # 搜索
   │   ├── ar-scan.tsx         # AR 识茶
   │   ├── login.tsx           # 登录
   │   └── _layout.tsx         # 根布局
   ├── components/             # 可复用组件
   │   ├── ui/                 # 基础 UI 组件
   │   │   ├── Button.tsx
   │   │   ├── Card.tsx
   │   │   ├── Badge.tsx
   │   │   └── Input.tsx
   │   ├── product/            # 产品相关组件
   │   │   ├── ProductCard.tsx
   │   │   ├── BrewingGuide.tsx
   │   │   └── FlavorProfile.tsx
   │   ├── home/               # 首页区块
   │   │   ├── HeroBanner.tsx
   │   │   ├── CategoryRow.tsx
   │   │   └── FeaturedProducts.tsx
   │   └── common/             # 通用组件
   │       ├── TabBar.tsx
   │       └── EmptyState.tsx
   ├── data/                   # 静态数据（从网站项目复制）
   │   └── products.ts
   ├── hooks/                  # 自定义 Hooks
   │   ├── useProducts.ts
   │   ├── useCart.ts
   │   └── useAuth.ts
   ├── stores/                 # 状态管理（Zustand）
   │   ├── cartStore.ts
   │   ├── authStore.ts
   │   └── favoriteStore.ts
   ├── services/               # API 请求层
   │   ├── api.ts
   │   ├── productService.ts
   │   └── orderService.ts
   ├── theme/                  # 设计系统
   │   ├── colors.ts           # 配色 Token
   │   ├── fonts.ts            # 字体配置
   │   ├── spacing.ts          # 间距系统
   │   └── index.ts
   ├── utils/                  # 工具函数
   ├── assets/                 # 静态资源（图片/图标）
   │   ├── images/
   │   └── icons/
   ├── tailwind.config.js      # NativeWind 配置
   └── app.json                # Expo 配置
   ```

4. **建立设计系统 Token**
   ```typescript
   // theme/colors.ts — 从你网站项目直接映射
   export const colors = {
     cream:     '#F5F0E8',
     charcoal:  '#2C2C2C',
     teaGreen:  '#5B7553',
     earth:     '#8B7355',
     mist:      '#D4CFC4',
     gold:      '#C4A265',
   };
   ```

5. **跑通 Hello World**
   - 确保模拟器能启动
   - 确保真机能扫码调试
   - 验证热更新正常

---

### 阶段 3：核心开发（6-10 周）

按优先级分迭代开发：

#### Sprint 1（第 1-2 周）：基础框架 + 首页
```
- 底部 Tab 导航
- 主题/字体/配色系统集成
- 首页布局：Hero Banner + 分类行 + 推荐产品
- 产品卡片组件
- 基础滚动和列表
```

#### Sprint 2（第 3-4 周）：商城核心流程
```
- 商城列表页（筛选/排序/分页）
- 茶品详情页（沉浸式布局 + 动画）
- 购物车功能（Zustand 状态管理）
- 冲泡指南展示
```

#### Sprint 3（第 5-6 周）：用户体系 + 交易
```
- 登录/注册（手机号 + 验证码）
- 个人中心
- 订单确认/结算页
- 收货地址管理
- 收藏功能
```

#### Sprint 4（第 7-8 周）：内容 + 社区
```
- 茶文化内容页（文章列表 + 详情）
- 搜索功能（历史 + 热搜 + 结果）
- 社区动态流
- 发帖/评论功能
```

#### Sprint 5（第 9-10 周）：高级功能 + 打磨
```
- AR 识茶（Camera + ML 模型）
- 礼品卡/送礼功能
- 推送通知
- 动画/转场打磨
- 骨架屏 + 空状态 + 错误状态
```

---

### 阶段 4：测试与优化（2-3 周）

| 测试类型 | 工具 | 关注点 |
|----------|------|--------|
| **真机测试** | 多品牌 Android 手机 | 不同屏幕尺寸/分辨率适配 |
| **性能测试** | React Native Performance Monitor | 列表滚动帧率 ≥ 55fps |
| **包体积** | `npx expo export` 分析 | 目标 < 30MB |
| **内存** | Android Studio Profiler | 无内存泄漏 |
| **网络** | 弱网模拟 | 离线/弱网优雅降级 |
| **兼容性** | Android 10-14 (API 29-34) | 覆盖 95%+ 用户 |
| **安全** | 依赖扫描 | 无已知漏洞 |

**优化重点：**
```
- 图片：使用 expo-image 自动缓存 + WebP 格式
- 列表：使用 FlashList 替代 FlatList（性能提升 5-10x）
- 动画：react-native-reanimated 在 UI 线程运行
- 启动：减少首屏依赖，使用 Splash Screen 过渡
- 包体积：Tree-shaking + 按需加载
```

---

### 阶段 5：打包与上架（1-2 周）

#### 5.1 构建 APK / AAB

```bash
# 使用 EAS Build（Expo 官方云构建）
npm install -g eas-cli
eas login
eas build:configure

# 构建 Android 生产包
eas build --platform android --profile production

# 或本地构建（需要配置好 Android 环境）
npx expo run:android --variant release
```

#### 5.2 签名配置

```
# 生成签名密钥（只需一次，妥善保管！）
keytool -genkeypair -v \
  -storetype JKS \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass <密码> \
  -keypass <密码> \
  -alias liji-tea \
  -keystore liji-tea-release.keystore \
  -dname "CN=Liji Tea,O=Liji Tea,L=Shanghai,C=CN"
```

#### 5.3 应用商店上架

| 平台 | 要求 | 周期 |
|------|------|------|
| **Google Play** | 开发者账号 $25（一次性）+ AAB 包 + 隐私政策 | 审核 1-3 天 |
| **国内应用商店** | 需要软著证书 + 企业开发者账号 + APK | 审核 3-7 天 |
| **华为应用市场** | 华为开发者账号 + AGC 配置 | 审核 1-3 天 |
| **小米/OPPO/VIVO** | 各自开发者平台注册 | 审核 1-5 天 |

**国内上架必备材料：**
```
1. 软件著作权证书（软著）— 申请周期 30-60 天，建议提前办
2. 企业营业执照（或个人身份证，部分平台支持个人）
3. APP 隐私政策页面（URL）
4. APP 安全评估报告（部分平台要求）
5. 应用截图 5-8 张 + 应用图标 512x512
6. 应用描述文案
```

---

## 五、后端服务方案

你的 APP 需要后端支持。推荐方案：

| 方案 | 说明 | 成本 | 适合 |
|------|------|------|------|
| **Supabase** | 开源 Firebase 替代，PostgreSQL + Auth + Storage + Realtime | 免费起步 | ⭐ 推荐 |
| **Firebase** | Google 全家桶，Auth + Firestore + Cloud Functions | 免费起步 | 快速原型 |
| **自建 Next.js API** | 用你熟悉的 Next.js 做 API 服务 | VPS ~¥50/月 | 完全掌控 |
| **Appwrite** | 开源 BaaS，自托管 | 免费 | 隐私敏感 |

**推荐组合：Supabase**
```
- 数据库：PostgreSQL（产品/订单/用户数据）
- 认证：Supabase Auth（手机号/微信登录）
- 存储：Supabase Storage（产品图片/用户头像）
- 实时：Supabase Realtime（社区动态推送）
- Edge Functions：处理支付回调等服务端逻辑
```

---

## 六、关键技术对照表（网站 → APP）

你已经熟悉的网站技术，在 APP 中的对应方案：

| 网站技术 | APP 对应 | 说明 |
|----------|----------|------|
| Next.js App Router | **Expo Router** | 文件式路由，几乎相同的思维模型 |
| Tailwind CSS v4 | **NativeWind v4** | 在 RN 中写 Tailwind 类名 |
| GSAP + ScrollTrigger | **Reanimated + Moti** | 声明式动画 + 手势驱动 |
| Framer Motion | **Moti** (基于 Reanimated) | 过渡动画 |
| Lenis 平滑滚动 | 原生 ScrollView | RN 原生滚动已经很丝滑 |
| Next.js Image | **expo-image** | 自动缓存/格式优化 |
| CSS 变量 (Token) | **theme/colors.ts** | JS 对象定义 Token |
| React hooks | **完全相同** | useEffect, useState, useRef |
| TypeScript | **完全相同** | 类型系统一模一样 |
| `<div>` / `<section>` | `<View>` | 布局容器 |
| `<p>` / `<span>` | `<Text>` | 文字必须包在 Text 里 |
| `<img>` | `<Image>` | expo-image 组件 |
| `onClick` | `onPress` | 触摸事件 |
| `className=""` | `className=""` | NativeWind 支持 |

---

## 七、开发工具终极对比：VSCode vs HBuilderX vs Android Studio

```
┌─────────────────────────────────────────────────────────────────┐
│                        你应该用什么？                           │
├───────────────┬──────────────┬──────────────┬──────────────────┤
│               │ VSCode       │ HBuilderX    │ Android Studio   │
├───────────────┼──────────────┼──────────────┼──────────────────┤
│ 适用框架      │ RN/Flutter   │ UniApp 专用   │ Kotlin 原生      │
│ 插件生态      │ ★★★★★       │ ★★★☆☆       │ ★★★★☆           │
│ 性能          │ ★★★★☆ 轻量  │ ★★★★☆ 轻量  │ ★★★☆☆ 重        │
│ 自由度        │ ★★★★★       │ ★★☆☆☆ 封闭  │ ★★★★☆           │
│ AI辅助集成    │ ★★★★★ 最强  │ ★★☆☆☆       │ ★★★☆☆           │
│ 调试体验      │ ★★★★☆       │ ★★★☆☆       │ ★★★★★           │
│ 你的熟悉度    │ ★★★★★       │ ★☆☆☆☆       │ ★★☆☆☆           │
├───────────────┼──────────────┼──────────────┼──────────────────┤
│ 结论          │ ✅ 主力编辑器 │ ❌ 不推荐     │ ⚙️ 仅管理模拟器  │
└───────────────┴──────────────┴──────────────┴──────────────────┘

最终配置：
- VSCode → 写代码（主力）
- Android Studio → 仅用于管理 SDK 和启动模拟器
- HBuilderX → 不需要（除非你选 UniApp 方案）
```

---

## 八、预算与时间估算

### 开发时间

| 阶段 | 独立全栈开发 | 有 AI 辅助 |
|------|-------------|-----------|
| 环境搭建 | 1-2 天 | 半天 |
| 基础框架 + 首页 | 2 周 | 1 周 |
| 商城核心 | 2 周 | 1-1.5 周 |
| 用户体系 + 交易 | 2 周 | 1-1.5 周 |
| 内容 + 社区 | 2 周 | 1 周 |
| 高级功能 | 2 周 | 1-1.5 周 |
| 测试优化 | 2 周 | 1-2 周 |
| 打包上架 | 1 周 | 1 周 |
| **合计** | **~14 周** | **~8-9 周** |

### 费用

| 项目 | 费用 | 说明 |
|------|------|------|
| Expo / React Native | 免费 | 开源 |
| Supabase | 免费起步 | Pro 计划 $25/月 |
| Google Play 开发者 | $25（一次性）| — |
| 国内软著 | ¥300-800 | 代办价格 |
| 国内应用商店 | 免费-¥300 | 各平台不同 |
| 服务器（如需） | ¥50-200/月 | 看流量 |
| Apple 开发者（如扩展 iOS）| $99/年 | 可选 |

---

## 九、Quick Start 命令

当你准备开始时，执行以下命令：

```bash
# 确认 Node.js 版本
node --version   # 需要 >= 18

# 创建项目
npx create-expo-app@latest liji-tea-app -t tabs

# 进入项目
cd liji-tea-app

# 安装核心依赖
npx expo install nativewind tailwindcss react-native-reanimated
npx expo install expo-image expo-camera expo-haptics
npx expo install @react-native-async-storage/async-storage
npm install zustand @tanstack/react-query

# 启动
npx expo start
```

然后在 VSCode 中打开项目，开始开发！

---

## 十、不上架直接分发 APK

**完全可以不上架应用商店，直接把 APK 发给别人安装。** 这是 Android 的开放优势。

### 10.1 构建可分发的 APK

```bash
# 方式一：EAS 云构建（推荐，不需要本地 Android 环境）
eas build --platform android --profile preview

# eas.json 配置：
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"          # 直接输出 APK（不是 AAB）
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"   # 上架 Google Play 用 AAB
      }
    }
  }
}

# 构建完成后，Expo 给你一个下载链接，下载 .apk 文件即可

# 方式二：本地构建（需要 Android SDK）
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# 输出：android/app/build/outputs/apk/release/app-release.apk
```

### 10.2 分发方式

| 方式 | 操作 | 适合场景 |
|------|------|----------|
| **直接发文件** | 微信/QQ/邮件发送 .apk 文件 | 发给朋友测试 |
| **网盘链接** | 上传到百度网盘/阿里云盘，分享链接 | 小范围分发 |
| **二维码下载** | APK 放到服务器，生成二维码扫码下载 | 线下推广 |
| **蒲公英/fir.im** | 国内内测分发平台，支持扫码安装 | 团队内测/公测 |
| **GitHub Releases** | 在 GitHub 仓库创建 Release 附带 APK | 开源项目 |
| **自建下载页** | 在你的网站 liji-tea.netlify.app 放下载链接 | 品牌官方渠道 |

### 10.3 蒲公英分发（最方便的内测平台）

```
1. 注册 pgyer.com（蒲公英）
2. 上传 APK → 自动生成下载页 + 二维码
3. 把二维码或链接发给任何人
4. 对方扫码 → 下载 → 安装

免费版：每天 50 次下载
收费版：不限下载 ¥68/月
```

### 10.4 接收方如何安装

对方收到 APK 后：
```
1. 点击 APK 文件
2. 系统提示"是否允许安装未知来源应用"
3. 点"设置" → 开启"允许此来源" → 返回
4. 点击"安装" → 完成

注意：Android 8.0+ 需要针对每个来源单独授权
例如：通过微信下载的需要授权微信，通过浏览器的需要授权浏览器
```

### 10.5 不上架 vs 上架对比

| | 不上架（直接分发 APK） | 上架应用商店 |
|---|---|---|
| 需要软著 | ❌ 不需要 | ✅ 国内必须 |
| 需要 APP 备案 | ❌ 不需要 | ✅ 国内必须 |
| 需要审核 | ❌ 不需要 | ✅ 每次更新都要审核 |
| 自动更新 | ❌ 需要自己实现 | ✅ 商店自动管理 |
| 用户信任度 | ⚠️ 低（"未知来源"警告） | ✅ 高 |
| 分发速度 | ✅ 秒发 | ⚠️ 审核 1-7 天 |
| 下载量统计 | ⚠️ 需要自己做 | ✅ 商店后台有 |
| SEO/曝光 | ❌ 无 | ✅ 商店搜索可发现 |
| 费用 | ✅ 零 | ⚠️ 软著+备案有成本 |

**建议策略：开发阶段用直接分发测试，功能稳定后再考虑上架。**

---

## 十一、国内应用商店上架完整指南

### 11.1 上架前必备材料

| 材料 | 说明 | 获取方式 | 周期 |
|------|------|----------|------|
| **软件著作权证书** | 国内上架硬性门槛 | 中国版权保护中心 或 找代办 | 自行 30-60 天 / 加急 3-7 天 |
| **营业执照** | 企业开发者必须 | 工商注册 | 个人身份证部分平台也可 |
| **隐私政策页面** | 必须有可访问的 URL | 放到你网站上 | 1 天 |
| **APP 备案** | 2023年起新规，所有 APP 必须备案 | 工信部 APP 备案系统 | 5-20 个工作日 |
| **签名 APK** | Release 签名的正式包 | EAS Build 或本地打包 | 即时 |

### 11.2 软著申请流程

```
1. 登录 中国版权保护中心（www.ccopyright.com.cn）
2. 注册账号 → 填写软件信息
3. 准备材料：
   - 软件源代码（前后各连续 30 页，共 60 页，每页 50 行）
   - 软件说明书（操作手册截图，10-15 页）
   - 身份证明（企业：营业执照 / 个人：身份证）
4. 在线提交 → 打印申请表签字 → 邮寄纸质材料
5. 等待审批 → 领取证书

代办价格参考：
- 普通（30-60天）：¥300-500
- 加急（3-7天）：¥1000-2000
```

### 11.3 APP 备案流程（2023年新规）

```
1. 登录工信部 APP 备案系统 beian.miit.gov.cn
2. 选择你 APP 分发的应用商店（至少一个）
3. 填写 APP 基本信息 + 主办单位信息
4. 上传材料（营业执照/身份证 + APP 截图）
5. 等待审核 → 获得 APP 备案号
6. 在 APP 内展示备案号（类似网站 ICP 备案）
```

### 11.4 各大应用商店一览

| 应用商店 | 注册地址 | 费用 | 审核 | 市场份额 |
|----------|----------|------|------|----------|
| **华为应用市场** | developer.huawei.com | 免费 | 1-3 天 | ~30% |
| **小米应用商店** | dev.mi.com | 免费 | 1-3 天 | ~15% |
| **OPPO 软件商店** | open.oppomobile.com | 免费 | 1-3 天 | ~15% |
| **VIVO 应用商店** | dev.vivo.com.cn | 免费 | 1-3 天 | ~12% |
| **应用宝（腾讯）** | app.open.qq.com | 免费 | 3-7 天 | ~10% |
| **百度手机助手** | app.baidu.com | 免费 | 3-5 天 | ~5% |
| **360手机助手** | dev.360.cn | 免费 | 3-5 天 | ~3% |

**优先上架前 4 家（华为/小米/OPPO/VIVO），覆盖 70%+ 用户。**

### 11.5 商店素材准备

```
1. APP 图标：512 x 512 px PNG（无圆角，无透明背景）

2. 应用截图：至少 3-5 张，推荐 5-8 张
   - 尺寸：1080 x 1920 px（竖屏）
   - 展示：首页、商城、茶品详情、购物车、个人中心

3. 应用描述
   - 一句话简介（30字内）："李记茶 — 东方美学茶品牌，探索千年茶文化"
   - 详细描述（200-500字）

4. 应用分类
   - 一级：购物
   - 二级：品质电商 / 食品饮料
```

### 11.6 提交审核流程

```
1. 登录开发者后台
2. 创建应用 → 填写基本信息
3. 上传 APK（签名后的 Release 包）
4. 上传图标 + 截图
5. 填写描述 + 分类 + 标签
6. 上传资质材料（软著证书 + 营业执照）
7. 填写隐私政策 URL + APP 备案号
8. 提交审核 → 等待通过 → 自动上架
```

### 11.7 常见审核被拒原因

| 被拒原因 | 解决方案 |
|----------|----------|
| 隐私政策不合规 | 详细列出收集的数据类型、用途、第三方 SDK |
| 缺少软著 | 补交软著证书 |
| 未做 APP 备案 | 完成工信部备案 |
| 虚假宣传 | 去掉"最好""第一"等绝对化用语 |
| 崩溃/闪退 | 充分测试后再提交 |
| 权限申请过多 | 只申请必要权限 |
| 缺少用户协议 | 添加用户协议页面 |

---

## 十二、Google Play 上架完整指南

### 12.1 注册开发者账号

```
1. 访问 https://play.google.com/console
2. Google 账号登录
3. 支付注册费：$25（一次性，约 ¥180）
4. 填写开发者资料（名称、邮箱、电话、网站）
5. 身份验证（2023年新政策）：
   - 个人：上传身份证/护照
   - 组织：营业执照 + D-U-N-S 编号
   - 验证周期：2-5 个工作日
```

### 12.2 创建应用

```
1. 点击"创建应用"
2. 应用名称：李记茶 (Liji Tea)
3. 默认语言：中文（简体）
4. 应用类型：应用（非游戏）
5. 免费/付费：免费（一旦选免费不能改）
6. 勾选内容政策和出口法律声明
```

### 12.3 填写商品详情

```
必填：
- 简短说明（80字内）："东方美学茶品牌 — 探索千年茶文化，品味高山好茶"
- 完整说明（4000字内）
- 应用图标：512 x 512 PNG
- 置顶大图：1024 x 500（商店顶部横幅）
- 手机截图：至少 2 张，推荐 8 张
- 应用分类：购物 (Shopping)
- 联系邮箱（必填）
```

### 12.4 政策声明（必须完成）

```
1. 隐私权政策 URL（必填）
2. 广告声明：是否包含广告 → 否
3. 内容分级：填写 IARC 问卷（约 5 分钟）
4. 目标受众：不面向 13 岁以下
5. 数据安全声明（必填）：
   - 个人信息（姓名/邮箱/电话）→ 用于账号和订单
   - 位置信息 → 用于配送地址
   - 照片/相机 → 用于 AR 识茶
   - 购买记录 → 用于订单管理
   - 数据加密传输 → 是（HTTPS）
   - 用户可请求删除数据 → 是
```

### 12.5 上传 AAB 包

Google Play **要求 AAB 格式**（不接受 APK）。

```bash
# EAS 构建 AAB
eas build --platform android --profile production

# eas.json production 配置确保 buildType 为 app-bundle
```

```
上传流程：
1. Play Console → 你的应用 → 发布 → 正式版
2. 创建新版本 → 上传 .aab 文件
3. 填写版本说明
4. 选择发布范围（全面/阶段性）
5. 提交审核
```

### 12.6 审核与上架

```
审核时间：新应用 3-7 天，更新 1-3 天

常见被拒原因：
- 隐私政策不完整 → 补充覆盖所有数据类型
- 数据安全声明不匹配 → 如实填写
- 功能不完整 → 充分测试后再提交
- 元数据违规 → 使用真实截图

好消息：你的 APP 是实物茶品电商
→ 可以用任何第三方支付（支付宝/微信/Stripe）
→ 不需要 Google Play 内购
→ Google 只对虚拟商品强制其计费系统
```

### 12.7 Google Play vs 国内商店对比

| | Google Play | 国内商店 |
|---|---|---|
| 注册费 | $25 一次性 | 免费 |
| 需要软著 | ❌ | ✅ |
| 需要备案 | ❌ | ✅ |
| 包格式 | AAB | APK |
| 审核周期 | 1-7 天 | 1-7 天 |
| 支付限制 | 实物商品自由 | 自由 |
| 覆盖 | 海外 Android | 国内 Android |
| 自动更新 | 统一管理 | 各平台分别管理 |

---

## 十三、APK 打包方式详解

你有两种方式打包，**都不一定需要 Android Studio**：

### 方式一：EAS Build 云打包 ⭐ 推荐

```bash
# 安装
npm install -g eas-cli
eas login

# 初始化配置
eas build:configure

# 打包 APK（测试/直接分发用）
eas build --platform android --profile preview

# 打包 AAB（Google Play 上架用）
eas build --platform android --profile production
```

构建完成后 Expo 给下载链接，直接下载 APK。

| 优点 | 缺点 |
|------|------|
| 不需要本地 Android 环境 | 免费账号每月 30 次构建 |
| 不需要 Android Studio | 排队 5-15 分钟 |
| 签名密钥自动管理 | 依赖网络 |
| 任何电脑都能打包 | |

### 方式二：本地打包

需要安装 Android Studio（用于 SDK 和 JDK）。

```bash
# 生成原生项目
npx expo prebuild --platform android

# 构建
cd android
./gradlew assembleRelease    # → APK
./gradlew bundleRelease      # → AAB

# APK 输出位置：
# android/app/build/outputs/apk/release/app-release.apk
```

| 优点 | 缺点 |
|------|------|
| 不限次数 | 需要 Android Studio (~10GB) |
| 完全离线 | 需要配置 JDK + SDK + 环境变量 |
| 速度快 | 首次配置麻烦 |

**建议：开发阶段全程用 EAS 云打包，等需要频繁调试原生模块时再装 Android Studio。**

---

## 十四、上架时间线总结

```
第 1 天 ──→ 开始开发 APP
         ├─→ 同步申请软著（30-60天，越早越好！）
         ├─→ 注册各平台开发者账号（1天）
         └─→ 写隐私政策 + 用户协议（1天）

第 8-9 周 ──→ APP 开发完成
           ├─→ 提交 APP 备案（5-20天）
           ├─→ 测试 + 打包签名 APK
           └─→ 准备截图 + 描述素材

备案通过 ──→ 提交各商店审核（1-7天）
         └─→ 上架完成

总计：从开始开发到上架，约 12-14 周
前提：软著必须在 APP 开发完成前拿到，所以第一天就要申请！
```

---

## 十五、分发策略建议

```
┌──────────────────────────────────────────────────┐
│              推荐的渐进式分发策略                  │
│                                                  │
│  阶段 1：内部测试（第 4-6 周）                    │
│  → 直接发 APK 给 3-5 个朋友测试                  │
│  → 用蒲公英平台管理测试版本                       │
│                                                  │
│  阶段 2：小范围公测（第 7-9 周）                  │
│  → 蒲公英/fir.im 分发，邀请 20-50 人             │
│  → 收集反馈，修复 Bug                            │
│                                                  │
│  阶段 3：正式发布（第 10-14 周）                  │
│  → 上架华为/小米/OPPO/VIVO 四大商店              │
│  → 可选：上架 Google Play（海外市场）            │
│  → 在你的网站放下载入口                          │
│                                                  │
│  如果不想上架：                                   │
│  → 在网站放 APK 下载链接 + 二维码即可            │
│  → 零成本、零审核、即时发布                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 十六、蒲公英（pgyer.com）分发详细操作

### 16.1 注册与准备

```
1. 打开 www.pgyer.com 注册账号
   - 支持手机号/邮箱/微信注册
   - 注册后即可使用，无需企业认证

2. 实名认证（推荐，提升下载额度）
   - 个人认证：身份证正反面照片
   - 企业认证：营业执照（可选）
```

### 16.2 上传 APK

**方式一：网页上传（最简单）**

```
1. 登录 pgyer.com → 点击右上角"发布应用"
2. 拖拽 .apk 文件到上传区域（或点击选择文件）
3. 等待上传完成（通常 30秒-2分钟）
4. 自动解析 APK 信息（应用名、版本号、包名、图标）
5. 填写补充信息：
   - 更新说明："v1.0.0 首次发布"
   - 安装密码（可选）：设置后需要输入密码才能下载
   - 有效期（可选）：设置下载链接过期时间
6. 点击"发布" → 完成！
```

**方式二：命令行上传（适合自动化）**

```bash
# 获取 API Key：pgyer.com → 账号设置 → API → 复制 API Key

# 使用 curl 上传
curl -F "file=@app-release.apk" \
     -F "_api_key=你的API_KEY" \
     -F "buildUpdateDescription=v1.0.0 首次发布" \
     https://www.pgyer.com/apiv2/app/upload
```

### 16.3 分享给别人

上传成功后你会得到：

```
1. 下载页面链接
   https://www.pgyer.com/xxxx （短链接）
   → 直接发给任何人，浏览器打开即可下载

2. 下载二维码
   → 一张二维码图片，手机扫码直接跳转到下载页
   → 可以打印贴在名片、传单、茶品包装上
   → 可以放到你的网站 liji-tea.netlify.app 上

3. 应用详情页
   → 显示应用名、图标、版本号、大小、更新说明
   → 支持查看历史版本
```

### 16.4 用户安装步骤

```
1. 扫码或打开链接 → 看到应用下载页面
2. 点击"安装"按钮 → 浏览器开始下载 .apk 文件
3. 下载完成后点击安装
   → 首次安装会提示"允许安装未知来源应用"
   → 设置 → 开启 → 返回 → 继续安装
4. 安装完成 → 打开使用

注意：Android 8.0+ 需要针对每个来源单独授权
例如：通过微信下载的需要授权微信，通过浏览器下载的需要授权浏览器
```

### 16.5 版本管理

```
更新版本时：
1. 打包新版本 APK（版本号递增，如 1.0.0 → 1.0.1）
2. 重新上传到蒲公英（同一包名自动归入同一应用）
3. 下载链接和二维码不变！
4. 用户再次扫码就会下载最新版本

历史版本管理：
- 蒲公英后台可以查看所有历史版本
- 可以回滚到任意历史版本
- 可以设置某个版本为"最新版"
```

### 16.6 应用内检查更新（可选）

让已安装用户知道有新版本：

```typescript
// services/updateService.ts
const CHECK_UPDATE_URL = 'https://www.pgyer.com/apiv2/app/check';

export async function checkForUpdate(currentVersion: string) {
  const response = await fetch(CHECK_UPDATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _api_key: '你的API_KEY',
      appKey: '你的APP_KEY',
      buildVersion: currentVersion,
    }),
  });
  const data = await response.json();

  if (data.data && data.data.buildHaveNewVersion) {
    // 有新版本，提示用户前往 data.data.downloadURL 下载
  }
}
```

### 16.7 蒲公英免费版 vs 付费版

| | 免费版 | 付费版（¥68/月起） |
|---|---|---|
| APK 上传分发 | ✅ | ✅ |
| 下载页 + 二维码 | ✅ | ✅ |
| 每日下载次数 | 50 次 | 不限 |
| 版本管理 | ✅ | ✅ |
| 基础下载统计 | ✅ | ✅ |
| 自定义下载页面 | ❌ | ✅（品牌 Logo、背景） |
| 应用内更新 SDK | ❌ | ✅ |
| 详细统计 | ❌ | ✅（设备/地区分布） |
| 团队协作 | ❌ | ✅ |
| API 自动化 | 有限 | ✅ |

### 16.8 最简操作总结

```
你（开发者）：
  eas build → 拿到 APK → 上传蒲公英 → 拿到二维码

对方（用户）：
  扫码 → 下载 → 安装 → 使用

整个过程不到 5 分钟，零成本。
```
