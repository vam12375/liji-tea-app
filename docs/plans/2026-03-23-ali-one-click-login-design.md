# 阿里云一键登录接入设计文档

> 文档版本：v1.0
> 日期：2026-03-23
> 状态：已批准

---

## 1. 背景与目标

为李记茶 App 接入**阿里云一键登录**功能，实现用户无需输入手机号即可完成登录，提升注册/登录转化率。

### 1.1 当前状态
- 现有登录方式：邮箱 + 密码（Supabase Auth）
- 目标：新增一键登录作为并行入口，用户可自由选择

### 1.2 成功标准
- 用户点击「一键登录」后，系统自动获取本机号码并完成验证
- 验证成功后自动创建/关联 Supabase 用户并登录
- 登录成功后与现有邮箱登录体验一致（跳回原页面）
- iOS / Android 双平台支持

---

## 2. 技术方案

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                     Expo App (前端)                       │
│                                                          │
│  [login.tsx]  ──▶  [useOneClickLogin hook]              │
│       │                      │                           │
│       │              [Native Module Bridge]               │
│       │                      │                           │
│       │              [AliOneClickModule]                 │
│       │                      │                           │
│       ▼                      ▼                           │
│  [userStore]         [阿里云 SDK]                        │
└──────────────────────────────│──────────────────────────┘
                               │ Token
                               ▼
┌──────────────────────────────────────────────────────────┐
│              Supabase (后端)                              │
│                                                          │
│  [Edge Function: ali-login] ──▶ [阿里云 API 验证]        │
│              │                                           │
│              │ 创建/关联用户 → 返回 Supabase Session      │
│              ▼                                           │
│      [Supabase Auth]                                    │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Native Module 方案（方案 A — 推荐）

- 在 `modules/ali-one-login/` 目录下创建 Native Module
- iOS：CocoaPod 方式集成 `AlicomCommunicationSDK`
- Android：Gradle 方式集成 `AlibabaCloudSDKDavLite`
- 前端通过 `expo-modules-core` 的 `NativeModule` 机制调用

**优点：**
- 完整掌控桥接代码，无第三方依赖
- 遵循 KISS — 逻辑清晰
- 版本可控，升级灵活

---

## 3. 文件结构

```
modules/
  ali-one-login/
    android/
      build.gradle
      src/main/java/com/lijitea/AliOneClickModule.kt
      src/main/AndroidManifest.xml
    ios/
      AliOneClickLogin.podspec
      AliOneClickModule.swift
    src/
      AliOneClickModule.ts       # Native Module 入口（跨平台 TS 定义）

src/
  hooks/
    useOneClickLogin.ts          # 登录逻辑封装
  lib/
    one-click/
      index.ts                   # 统一导出
  app/
    login.tsx                    # 修改：新增一键登录按钮入口

supabase/
  functions/
    ali-login/
      index.ts                   # Edge Function：Token 验证并登录
      deno.json

docs/
  plans/
    2026-03-23-ali-one-click-login-design.md  # 本文档
```

---

## 4. 核心模块设计

### 4.1 Native Module — `AliOneClickModule`

#### 暴露方法（TS 接口）

```typescript
interface AliOneClickModule {
  /** 预取 Token（加速授权页拉起） */
  prefetchToken(): Promise<void>;

  /** 调起一键登录授权页，返回 Token */
  login(): Promise<{ token: string; phoneNumber: string }>;

  /** 退出登录，释放资源 */
  quit(): Promise<void>;

  /** 检查当前网络环境是否支持一键登录 */
  checkEnvAvailable(): Promise<boolean>;
}
```

#### iOS 实现要点
- 集成 `AlicomCommunicationSDK`（CocoaPods）
- 调用 `AlicomAuthManager` 的 `getVerifyToken` 获取 Token
- 需要在 `Info.plist` 配置：`AlicomPrivacyDescription`
- AppDelegate 中初始化 SDK

#### Android 实现要点
- 集成 `com.aliyun.aliyun:android-yunos-auth-commons`（Gradle）
- 调用 `AuthHelper` 的 `getToken` 获取 Token
- AndroidManifest 配置必要权限：
  - `android.permission.INTERNET`
  - `android.permission.READ_PHONE_STATE`
  - `android.permission.ACCESS_NETWORK_STATE`

### 4.2 Hook — `useOneClickLogin`

```typescript
interface UseOneClickLogin {
  // 状态
  loading: boolean;
  error: string | null;
  isSupported: boolean;        // 运营商环境是否支持

  // 方法
  checkSupport(): Promise<boolean>;
  login(): Promise<{ success: boolean; error?: string }>;
  quit(): Promise<void>;
}
```

**内部流程：**
1. `checkSupport()` → 调用 `AliOneClickModule.checkEnvAvailable()`
2. `login()` → 调用 `AliOneClickModule.login()` → 获取 Token
3. 调用 `supabaseEdgeFunction('ali-login', { token })` → 验证并登录
4. 返回结果，错误处理

### 4.3 Supabase Edge Function — `ali-login`

**端点：** `supabase/functions/ali-login`

**请求：**
```typescript
// POST body
{ token: string }
```

**处理流程：**
1. 接收前端传来的 Token
2. 调用阿里云 API 验证 Token（需传入 AccessKey、Secret、AppKey）
3. 解析返回的手机号
4. 在 Supabase 中查找/创建用户（通过手机号关联）
5. 生成 Supabase Session 并返回

**响应：**
```typescript
// 成功
{
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: User;
  }
}

// 失败
{ error: string }
```

**安全要点：**
- Edge Function 必须验证 Token 合法性，不能信任前端数据
- AccessKey/Secret 存储在 Supabase Secrets 中，不暴露在前端
- 设置合理的 Rate Limit 防止滥用

---

## 5. 前端 UI 改造

### 5.1 登录页改造 (`src/app/login.tsx`)

**新增一键登录按钮：**

```tsx
// 新增导入
import { useOneClickLogin } from '@/hooks/useOneClickLogin';

// 新增按钮（邮箱登录表单上方）
<Pressable
  onPress={handleOneClickLogin}
  disabled={loading}
  className="bg-primary-container rounded-full py-4 items-center justify-center mb-4"
>
  <Text className="text-on-primary font-medium">
    {loading ? '登录中...' : '本机号码一键登录'}
  </Text>
</Pressable>

// 新增分隔 + 其他方式
<View className="flex-row items-center gap-3">
  <View className="flex-1 h-px bg-outline/30" />
  <Text className="text-outline text-sm">其他方式登录</Text>
  <View className="flex-1 h-px bg-outline/30" />
</View>
```

---

## 6. 阿里云控制台配置清单

接入前需在阿里云完成以下配置：

| 步骤 | 内容 | 备注 |
|------|------|------|
| 1 | 注册阿里云账号 | 建议使用子账号 AccessKey |
| 2 | 开通「数字验证码服务」 | 一键登录产品 |
| 3 | 创建 iOS 应用 | 填写 Bundle ID、SHA1 签名 |
| 4 | 创建 Android 应用 | 填写 Package Name、SHA1 签名 |
| 5 | 申请签名和模板 | 获取 SignName、TemplateCode |
| 6 | 配置回调地址 | 用于 Token 验证回调 |

**⚠️ 注意：**
- iOS 的 SHA1 需使用正式证书的 SHA1（Apple Store / AdHoc）
- Android 的 SHA1 需使用正式 keystore 的 SHA1
- 测试阶段可使用 Debug 签名，但上线前必须替换

---

## 7. 错误处理

| 错误场景 | 用户提示 | 处理方式 |
|----------|----------|----------|
| 运营商不支持 | "当前网络环境不支持，请使用其他方式登录" | 自动隐藏一键登录按钮 |
| Token 获取失败 | "一键登录失败，请重试" | 展示邮箱登录入口 |
| 后端验证失败 | "登录失败，请稍后重试" | 降级到邮箱登录 |
| 用户取消授权 | 无提示 | 静默返回登录页 |
| 网络异常 | "网络连接失败" | 重试按钮 |

---

## 8. 测试计划

### 8.1 真机测试（必需）
- Android + iOS 各一台真机
- 测试不同运营商网络（移动/联通/电信）
- 测试 WiFi / 4G 切换场景

### 8.2 测试用例
- [ ] 正常一键登录流程
- [ ] 用户取消授权
- [ ] 网络异常时的错误提示
- [ ] 登录成功后页面跳转
- [ ] 新用户首次登录（创建账号）
- [ ] 老用户再次登录（已有账号关联）

---

## 9. 设计原则遵循

| 原则 | 本方案对应 |
|------|-----------|
| **KISS** | Native Module 直连，无过度抽象 |
| **YAGNI** | 不预先封装 Expo Module，先实现功能 |
| **SOLID-Single** | 各模块职责单一：Native 模块（通信）、Hook（状态）、Edge Function（验证） |
| **SOLID-Open/Closed** | 新增一键登录不影响现有邮箱登录逻辑 |

---

## 10. 下一步

详见 **实施计划**，包含：
1. 阿里云控制台配置指南
2. Native Module 详细实现步骤
3. Supabase Edge Function 代码模板
4. 前端 UI 改造具体代码
5. 测试验证清单
