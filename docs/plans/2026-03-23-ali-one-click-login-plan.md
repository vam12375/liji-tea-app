# 阿里云一键登录实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为李记茶 App 接入阿里云一键登录，实现用户无需输入手机号即可完成登录。

**Architecture:** 采用 Native Module 桥接阿里云 SDK，前端通过 Hook 调用，验证逻辑放在 Supabase Edge Function 处理。Native 模块分为 iOS (CocoaPod) 和 Android (Gradle) 两部分，前端统一封装为 TypeScript 接口。

**Tech Stack:** Expo SDK 55, React Native 0.83, 阿里云 SDK (AlicomCommunicationSDK / AlibabaCloudSDKDavLite), Supabase Edge Functions, TypeScript, Native Modules

---

## 阶段一：阿里云控制台配置

> ⚠️ **此阶段由用户手动完成**，AI 无法代替操作阿里云控制台。

### Task 1: 阿里云账号与产品开通

**目标:** 开通阿里云数字验证码服务

**前置准备:**
- 注册阿里云账号 (https://www.aliyun.com)
- 建议创建子账号 AccessKey（遵循最小权限原则）

**操作步骤:**

1. 登录阿里云控制台 → 搜索「数字验证码」→ 开通服务
2. 创建 AccessKey：控制台右上角 → AccessKey → 创建子账号 AccessKey
3. 记录以下信息（稍后填入环境变量）:
   - `ALI_ACCESS_KEY_ID`
   - `ALI_ACCESS_KEY_SECRET`
   - `ALI_APP_KEY` (一键登录应用 ID)

---

### Task 2: 配置 iOS 应用

**目标:** 在阿里云后台创建 iOS 应用，获取 Bundle ID 和签名配置

**操作步骤:**

1. 数字验证码控制台 → 应用管理 → 添加应用 → 选择 iOS
2. 填写以下信息:
   - Bundle ID：`com.lijitea.app`（需与项目一致，参考 `app.json` 的 `android.package` 和 iOS Bundle ID）
   - SHA1 签名：使用正式证书的 SHA1
3. 申请签名模板：联系阿里云技术支持或使用自助签名申请
4. 记录 SignName 和 TemplateCode

**⚠️ 注意:**
- iOS 的 SHA1 必须是正式发布证书的签名
- 测试阶段可先用开发证书 SHA1，但上线前必须替换

---

### Task 3: 配置 Android 应用

**目标:** 在阿里云后台创建 Android 应用

**操作步骤:**

1. 数字验证码控制台 → 应用管理 → 添加应用 → 选择 Android
2. 填写以下信息:
   - Package Name：`com.lijitea.app`（参考 `app.json` 的 `android.package`）
   - SHA1 签名：使用正式 keystore 的 SHA1

**获取 SHA1 方法（Debug）:**
```bash
# 在 android/ 目录执行
./gradlew signingReport
# 找到 variant: debug 的 SHA1
```

**获取 SHA1 方法（Release）:**
```bash
# 使用 keytool
keytool -list -v -keystore your-release-keystore.jks -alias your-alias
```

---

### Task 4: 配置 Supabase Secrets

**目标:** 将阿里云凭证安全存储在 Supabase Edge Function 环境变量中

**操作步骤:**

1. 登录 Supabase Dashboard → 项目 → Settings → Edge Functions
2. 添加以下 Secrets:
   - `ALI_ACCESS_KEY_ID`: 你的阿里云 AccessKey ID
   - `ALI_ACCESS_KEY_SECRET`: 你的阿里云 AccessKey Secret
   - `ALI_APP_KEY`: 一键登录 App Key

---

## 阶段二：Supabase Edge Function

### Task 5: 创建 Edge Function 项目结构

**Files:**
- Create: `supabase/functions/ali-login/index.ts`
- Create: `supabase/functions/ali-login/deno.json`

**Step 1: 创建目录和基础文件**

```bash
mkdir -p supabase/functions/ali-login
```

**Step 2: 创建 deno.json**

```json
{
  "imports": {
    "$supabase/functions": "https://esm.sh/@supabase/functions-js@2.4.1"
  },
  "tasks": {
    "deploy": "supabase functions deploy ali-login"
  }
}
```

**Step 3: 创建 index.ts（基础版本）**

```typescript
// supabase/functions/ali-login/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "$supabase/functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. 解析请求体
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token 不能为空" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. 获取阿里云凭证
    const aliAccessKeyId = Deno.env.get("ALI_ACCESS_KEY_ID");
    const aliAccessKeySecret = Deno.env.get("ALI_ACCESS_KEY_SECRET");
    const aliAppKey = Deno.env.get("ALI_APP_KEY");

    if (!aliAccessKeyId || !aliAccessKeySecret || !aliAppKey) {
      return new Response(
        JSON.stringify({ error: "服务器配置错误" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. 调用阿里云 API 验证 Token
    // 阿里云一键登录 Token 验证接口
    const verifyUrl = `https://dypnsapi.aliyuncs.com/?Action=GetMobile&AppKey=${aliAppKey}`;

    const timestamp = new Date().toISOString();
    const signature = await generateSignature({
      accessKeySecret: aliAccessKeySecret,
      timestamp,
    });

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Version": "2017-05-25",
      },
      body: JSON.stringify({
        Token: token,
        Timestamp: timestamp,
        Signature: signature,
        AppKey: aliAppKey,
        AccessKeyId: aliAccessKeyId,
      }),
    });

    const verifyResult = await verifyResponse.json();

    if (verifyResult.Code !== "OK" || !verifyResult.Mobile) {
      return new Response(
        JSON.stringify({ error: verifyResult.Message || "Token 验证失败" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneNumber = verifyResult.Mobile;

    // 4. 创建/查找 Supabase 用户
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 查找是否已存在关联该手机号的用户
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("phone", phoneNumber)
      .single();

    let userId: string;

    if (existingUser) {
      // 已存在用户，直接使用
      userId = existingUser.user_id;
    } else {
      // 创建新用户（匿名用户或通过手机号创建）
      // 由于 Supabase Auth 不直接支持手机号密码创建，需使用 Admin API
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone: phoneNumber,
        phone_confirmed_at: new Date().toISOString(),
      });

      if (createError) {
        console.error("创建用户失败:", createError);
        return new Response(
          JSON.stringify({ error: "创建用户失败" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user?.id ?? "";
    }

    // 5. 生成 Supabase Session
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: `+${phoneNumber}@phone-auth.lijitea.com`,
    });

    if (sessionError) {
      // 回退方案：直接生成 token
      const { data: tokenData } = await supabase.auth.admin.generateLink({
        type: "signup",
        email: `ali-${phoneNumber}@phone.lijitea.com`,
      });

      return new Response(
        JSON.stringify({
          session: {
            access_token: tokenData?.properties?.href?.split("&token=")[1] || "",
            refresh_token: "",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ session: sessionData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge Function 错误:", error);
    return new Response(
      JSON.stringify({ error: "服务器内部错误" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// 阿里云签名生成（简化版，实际请参考阿里云官方 SDK）
async function generateSignature(params: {
  accessKeySecret: string;
  timestamp: string;
}): Promise<string> {
  const { accessKeySecret, timestamp } = params;
  const stringToSign = `GET&%2F&timestamp=${encodeURIComponent(timestamp)}`;
  const key = new TextEncoder().encode(accessKeySecret + "&");
  const msg = new TextEncoder().encode(stringToSign);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
```

**Step 4: 部署 Edge Function**

```bash
cd supabase
supabase functions deploy ali-login
```

---

## 阶段三：Native Module 开发

### Task 6: 创建 iOS Native Module (CocoaPod)

**Files:**
- Create: `modules/ali-one-login/ios/AliOneClickLogin.podspec`
- Create: `modules/ali-one-login/ios/AliOneClickModule.swift`
- Create: `modules/ali-one-login/ios/AliOneClickModule.m`（桥接文件）

**Step 1: 创建 podspec 文件**

```ruby
# modules/ali-one-login/ios/AliOneClickLogin.podspec

Pod::Spec.new do |s|
  s.name         = "AliOneClickLogin"
  s.version      = "1.0.0"
  s.summary      = "阿里云一键登录 Native Module"
  s.description  = "为李记茶 App 提供阿里云一键登录功能的桥接模块"
  s.homepage     = "https://github.com/lijitea/ali-one-login"
  s.license      = { :type => "MIT" }
  s.author       = { "LijiTea" => "dev@lijitea.com" }
  s.platform     = :ios, "13.0"
  s.source       = { :path => "." }
  s.source_files = "*.{h,m,swift}"
  s.dependency   "AlicomCommunicationSDK"  # 阿里云 SDK

  s.requires_arc = true
  s.swift_version = "5.0"

  s.info_plist = {
    "AlicomPrivacyDescription" => "我们需要获取您的手机号码以实现一键登录功能"
  }
end
```

**Step 2: 创建 Swift 实现文件**

```swift
// modules/ali-one-login/ios/AliOneClickModule.swift

import Foundation
import AlicomCommunicationSDK

@objc(AliOneClickModule)
class AliOneClickModule: NSObject {

  private var authManager: AlicomAuthManager?
  private var currentToken: String?

  override init() {
    super.init()
    setupAuthManager()
  }

  private func setupAuthManager() {
    // 初始化阿里云 SDK
    // 实际 AppKey 需要从 Native Modules 配置或 Constants 中获取
    let appKey = Bundle.main.object(forInfoDictionaryKey: "ALI_APP_KEY") as? String ?? ""

    authManager = AlicomAuthManager(appKey: appKey)
  }

  /// 检查当前网络环境是否支持一键登录
  @objc
  func checkEnvAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let manager = authManager else {
      resolve(false)
      return
    }

    manager.checkEnvAvailable { available in
      resolve(available)
    } failure: { error in
      resolve(false)
    }
  }

  /// 预取 Token（加速授权页拉起）
  @objc
  func prefetchToken(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let manager = authManager else {
      reject("E_NO_MANAGER", "AuthManager 未初始化", nil)
      return
    }

    manager.prefetchToken { token in
      self.currentToken = token
      resolve(nil)
    } failure: { error in
      reject("E_PREFETCH", error?.localizedDescription ?? "预取 Token 失败", error)
    }
  }

  /// 调起一键登录授权页
  @objc
  func login(_ resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let manager = authManager else {
      reject("E_NO_MANAGER", "AuthManager 未初始化", nil)
      return
    }

    // 获取当前控制器的引用（需要在主线程调用）
    DispatchQueue.main.async {
      guard let rootVC = UIApplication.shared.windows.first?.rootViewController else {
        reject("E_NO_VC", "无法获取根控制器", nil)
        return
      }

      manager.getVerifyToken(fromVC: rootVC) { token in
        guard let token = token, !token.isEmpty else {
          reject("E_NO_TOKEN", "未获取到 Token", nil)
          return
        }

        // 尝试获取手机号（如果 SDK 支持）
        let phoneNumber = self.extractPhoneNumber(fromToken: token)

        resolve([
          "token": token,
          "phoneNumber": phoneNumber ?? ""
        ])
      } failure: { error in
        if let error = error as? NSError {
          // 用户取消不返回错误
          if error.code == -1 {
            reject("E_USER_CANCEL", "用户取消", error)
          } else {
            reject("E_LOGIN_FAILED", error.localizedDescription, error)
          }
        } else {
          reject("E_LOGIN_FAILED", "登录失败", nil)
        }
      }
    }
  }

  /// 退出登录，释放资源
  @objc
  func quit(_ resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock) {
    currentToken = nil
    authManager?.quit()
    resolve(nil)
  }

  /// 从 Token 中提取手机号（实际需要服务端验证后返回）
  private func extractPhoneNumber(fromToken token: String) -> String? {
    // 阿里云 SDK 返回的 Token 需要在服务端验证后才能获取真实手机号
    // 此处返回空，由 Edge Function 验证后返回真实手机号
    return nil
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
```

**Step 3: 创建 Objective-C 桥接文件**

```objc
// modules/ali-one-login/ios/AliOneClickModule.m

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AliOneClickModule, NSObject)

RCT_EXTERN_METHOD(checkEnvAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(prefetchToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(login:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(quit:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

**Step 4: 更新项目的 ios/Podfile**

在 `ios/Podfile` 中添加本地 Pod 路径：

```ruby
# ios/Podfile

# ... 现有内容 ...

# 阿里云一键登录
pod 'AliOneClickLogin', :path => '../modules/ali-one-login/ios'

target 'LijiteaApp' do
  # ... 现有 pod 内容 ...

  # 确保 React Native 核心模块存在
  pod 'React-Core', :path => '../node_modules/react-native/ReactCommon'
end
```

**Step 5: 执行 pod install**

```bash
cd ios
pod install
```

---

### Task 7: 创建 Android Native Module

**Files:**
- Create: `modules/ali-one-login/android/build.gradle`
- Create: `modules/ali-one-login/android/src/main/AndroidManifest.xml`
- Create: `modules/ali-one-login/android/src/main/java/com/lijitea/AliOneClickModule.kt`
- Create: `modules/ali-one-login/android/src/main/java/com/lijitea/AliOneClickPackage.kt`

**Step 1: 创建 build.gradle**

```groovy
// modules/ali-one-login/android/build.gradle

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.lijitea.alioneclick"
    compileSdk = 34

    defaultConfig {
        minSdk = 21
        targetSdk = 34
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("com.facebook.react:react-native:0.83.2")

    // 阿里云一键登录 SDK
    implementation("com.aliyun.aliyun:android-yunos-auth-commons:1.1.4")
    implementation("com.aliyun.aliyun:android-dypns-sdk:1.1.0")
}
```

**Step 2: 创建 AndroidManifest.xml**

```xml
<!-- modules/ali-one-login/android/src/main/AndroidManifest.xml -->

<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- 阿里云一键登录所需权限 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application>
        <!-- 阿里云 SDK 配置 -->
        <meta-data
            android:name="ALI_APP_KEY"
            android:value="${ALI_APP_KEY}" />

        <activity
            android:name="com.alipay.mobile.nebulaauth-sdk.android.activity.UcSdkWebActivity"
            android:configChanges="orientation|keyboardHidden"
            android:exported="false"
            android:screenOrientation="portrait" />
    </application>
</manifest>
```

**Step 3: 创建 Native Module 实现**

```kotlin
// modules/ali-one-login/android/src/main/java/com/lijitea/AliOneClickModule.kt

package com.lijitea.alioneclick

import com.facebook.react.bridge.*
import com.aliyun.aliyun.dypnsdkfactory.DypnsFactory
import com.aliyun.aliyun.dypnsdkfactory.model.DyModuleParams
import com.aliyun.aliyun.dypnsdkfactory.model.DyError
import kotlinx.coroutines.*

class AliOneClickModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var authClient: Any? = null

    override fun getName(): String = "AliOneClickModule"

    init {
        // 初始化阿里云 SDK
        // 注意：实际 AppKey 需要从 AndroidManifest 或 NativeModules Config 获取
        val appKey = BuildConfig.ALI_APP_KEY ?: ""
        if (appKey.isNotEmpty()) {
            initializeSdk(appKey)
        }
    }

    private fun initializeSdk(appKey: String) {
        try {
            val params = DyModuleParams.Builder()
                .setAppKey(appKey)
                .setContext(reactApplicationContext)
                .build()

            DypnsFactory.init(reactApplicationContext, params)
            authClient = DypnsFactory.getAuthClient()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun checkEnvAvailable(promise: Promise) {
        scope.launch {
            try {
                val client = authClient
                if (client == null) {
                    promise.resolve(false)
                    return@launch
                }

                // 调用 SDK 检查环境
                val available = checkNetworkOperator()
                promise.resolve(available)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun prefetchToken(promise: Promise) {
        scope.launch {
            try {
                // 预取 Token
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("E_PREFETCH", "预取 Token 失败: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun login(promise: Promise) {
        scope.launch {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject("E_NO_ACTIVITY", "无法获取 Activity", null)
                    return@launch
                }

                val client = authClient
                if (client == null) {
                    promise.reject("E_NO_CLIENT", "SDK 未初始化", null)
                    return@launch
                }

                // 调起一键登录授权页
                // 实际实现需要参考阿里云 SDK 文档
                val result = openAuthPage(activity)

                if (result.success) {
                    val response = Arguments.createMap().apply {
                        putString("token", result.token ?: "")
                        putString("phoneNumber", result.phoneNumber ?: "")
                    }
                    promise.resolve(response)
                } else {
                    if (result.userCancel) {
                        promise.reject("E_USER_CANCEL", "用户取消", null)
                    } else {
                        promise.reject("E_LOGIN_FAILED", result.errorMessage ?: "登录失败", null)
                    }
                }
            } catch (e: Exception) {
                promise.reject("E_LOGIN_FAILED", "登录失败: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun quit(promise: Promise) {
        try {
            // 释放 SDK 资源
            authClient = null
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_QUIT", "退出失败: ${e.message}", e)
        }
    }

    private fun checkNetworkOperator(): Boolean {
        // 检查运营商网络是否支持
        // 实际实现需要检查 SIM 卡状态和运营商信息
        return true
    }

    private fun openAuthPage(activity: android.app.Activity): AuthResult {
        // 调起阿里云授权页
        // 返回 Token 和手机号
        // 实际实现需要参考阿里云 SDK 回调
        return AuthResult(success = false)
    }

    data class AuthResult(
        val success: Boolean,
        val token: String? = null,
        val phoneNumber: String? = null,
        val userCancel: Boolean = false,
        val errorMessage: String? = null
    )
}
```

**Step 4: 创建 React Package**

```kotlin
// modules/ali-one-login/android/src/main/java/com/lijitea/AliOneClickPackage.kt

package com.lijitea.alioneclick

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AliOneClickPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(AliOneClickModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

**Step 5: 注册 Package**

在 `android/app/build.gradle` 中注册 Native Package：

```groovy
// android/app/build.gradle

dependencies {
    // ... existing dependencies

    // 阿里云一键登录
    implementation project(':ali-one-login')
}
```

在 `MainApplication.kt` 或 `MainApplication.java` 中注册：

```kotlin
// android/app/src/main/java/com/lijitea/app/MainApplication.kt

import com.lijitea.alioneclick.AliOneClickPackage

override fun getPackages(): List<ReactPackage> {
    return listOf(
        // ... existing packages
        AliOneClickPackage()
    )
}
```

---

### Task 8: 创建 TypeScript 桥接层

**Files:**
- Create: `modules/ali-one-login/src/AliOneClickModule.ts`

**Step 1: 创建 TypeScript 入口**

```typescript
// modules/ali-one-login/src/AliOneClickModule.ts

import { NativeModules, Platform } from 'react-native';

// 定义 Native Module 接口
interface AliOneClickNativeModule {
  checkEnvAvailable(): Promise<boolean>;
  prefetchToken(): Promise<void>;
  login(): Promise<{ token: string; phoneNumber: string }>;
  quit(): Promise<void>;
}

// 获取 Native Module 实例
const { AliOneClickModule: NativeModule } = NativeModules;

// 类型守卫：检查模块是否可用
function isModuleAvailable(): NativeModule is AliOneClickNativeModule {
  return !!NativeModule && typeof NativeModule.checkEnvAvailable === 'function';
}

// 抛出清晰的错误信息
if (!isModuleAvailable()) {
  console.warn(
    '[AliOneClickModule] Native Module 未找到。请确保已完成以下配置：\n' +
    '- iOS: 运行 pod install\n' +
    `- Android: 在 MainApplication 中注册 AliOneClickPackage\n` +
    `当前平台: ${Platform.OS}`
  );
}

export interface OneClickLoginResult {
  token: string;
  phoneNumber: string;
}

export interface AliOneClickModuleInterface {
  checkEnvAvailable(): Promise<boolean>;
  prefetchToken(): Promise<void>;
  login(): Promise<OneClickLoginResult>;
  quit(): Promise<void>;
}

const AliOneClickModule: AliOneClickModuleInterface = {
  /**
   * 检查当前网络环境是否支持一键登录
   * @returns true 表示支持，false 表示不支持
   */
  checkEnvAvailable: async (): Promise<boolean> => {
    if (!isModuleAvailable()) return false;
    try {
      return await NativeModule.checkEnvAvailable();
    } catch (error) {
      console.warn('[AliOneClickModule] checkEnvAvailable 失败:', error);
      return false;
    }
  },

  /**
   * 预取 Token，加速授权页拉起
   * 建议在页面加载时调用
   */
  prefetchToken: async (): Promise<void> => {
    if (!isModuleAvailable()) return;
    try {
      await NativeModule.prefetchToken();
    } catch (error) {
      console.warn('[AliOneClickModule] prefetchToken 失败:', error);
    }
  },

  /**
   * 调起一键登录授权页
   * @returns 包含 token 和 phoneNumber 的结果
   * @throws E_USER_CANCEL - 用户取消授权
   * @throws E_LOGIN_FAILED - 登录失败
   */
  login: async (): Promise<OneClickLoginResult> => {
    if (!isModuleAvailable()) {
      throw new Error('Native Module 未初始化');
    }
    return await NativeModule.login();
  },

  /**
   * 退出登录，释放资源
   * 建议在用户退出登录时调用
   */
  quit: async (): Promise<void> => {
    if (!isModuleAvailable()) return;
    try {
      await NativeModule.quit();
    } catch (error) {
      console.warn('[AliOneClickModule] quit 失败:', error);
    }
  },
};

export default AliOneClickModule;
```

---

## 阶段四：前端 Hook 开发

### Task 9: 创建 useOneClickLogin Hook

**Files:**
- Create: `src/hooks/useOneClickLogin.ts`

**Step 1: 创建 Hook**

```typescript
// src/hooks/useOneClickLogin.ts

import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import AliOneClickModule from '@/modules/ali-one-login/src/AliOneClickModule';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/userStore';
import { showModal } from '@/stores/modalStore';

interface UseOneClickLogin {
  // 状态
  loading: boolean;
  error: string | null;
  isSupported: boolean;

  // 方法
  checkSupport(): Promise<boolean>;
  login(): Promise<{ success: boolean; error?: string }>;
  quit(): Promise<void>;
}

export function useOneClickLogin(): UseOneClickLogin {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const { fetchProfile, fetchAddresses, fetchFavorites } = useUserStore();

  // 检查是否支持一键登录
  const checkSupport = useCallback(async (): Promise<boolean> => {
    try {
      const supported = await AliOneClickModule.checkEnvAvailable();
      setIsSupported(supported);
      return supported;
    } catch (err) {
      console.warn('[useOneClickLogin] checkSupport 失败:', err);
      setIsSupported(false);
      return false;
    }
  }, []);

  // 初始化时检查支持状态
  useEffect(() => {
    checkSupport();
    return () => {
      // 组件卸载时退出
      AliOneClickModule.quit();
    };
  }, [checkSupport]);

  // 一键登录主流程
  const login = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (loading) return { success: false, error: '正在登录中' };

    setLoading(true);
    setError(null);

    try {
      // 1. 检查是否支持
      const supported = await AliOneClickModule.checkEnvAvailable();
      if (!supported) {
        return {
          success: false,
          error: '当前网络环境不支持一键登录，请使用其他方式登录'
        };
      }

      // 2. 调起授权页，获取 Token
      let token: string;
      let phoneNumber: string;

      try {
        const result = await AliOneClickModule.login();
        token = result.token;
        phoneNumber = result.phoneNumber;
      } catch (err: any) {
        // 用户取消不显示错误
        if (err?.code === 'E_USER_CANCEL' || err?.message?.includes('用户取消')) {
          setLoading(false);
          return { success: false, error: undefined }; // 用户取消，不显示错误
        }
        throw err;
      }

      if (!token) {
        return { success: false, error: '未获取到登录凭证' };
      }

      // 3. 调用 Supabase Edge Function 验证 Token
      const { data, error: edgeError } = await supabase.functions.invoke(
        'ali-login',
        {
          body: { token },
        }
      );

      if (edgeError) {
        console.error('[useOneClickLogin] Edge Function 调用失败:', edgeError);
        return { success: false, error: '登录验证失败，请稍后重试' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      // 4. 处理登录成功
      if (data?.session) {
        // 设置 Session
        const { session } = data;

        // 调用 userStore 的 setSession
        useUserStore.getState().setSession(session);

        // 刷新用户数据
        await fetchProfile();
        await fetchAddresses();
        await fetchFavorites();

        setLoading(false);
        return { success: true };
      }

      return { success: false, error: '登录失败，请稍后重试' };

    } catch (err: any) {
      console.error('[useOneClickLogin] 登录异常:', err);
      const errorMessage = err?.message || '登录失败，请稍后重试';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [loading, fetchProfile, fetchAddresses, fetchFavorites]);

  // 退出登录
  const quit = useCallback(async (): Promise<void> => {
    try {
      await AliOneClickModule.quit();
    } catch (err) {
      console.warn('[useOneClickLogin] quit 失败:', err);
    }
  }, []);

  return {
    loading,
    error,
    isSupported,
    checkSupport,
    login,
    quit,
  };
}
```

---

## 阶段五：前端 UI 改造

### Task 10: 修改登录页 UI

**Files:**
- Modify: `src/app/login.tsx`

**Step 1: 在文件顶部添加导入**

```typescript
import { useOneClickLogin } from '@/hooks/useOneClickLogin';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
```

**Step 2: 在组件内添加 Hook**

```typescript
export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useUserStore();
  const { loading: oneClickLoading, isSupported, login: doOneClickLogin } = useOneClickLogin();
  // ... existing code
```

**Step 3: 添加一键登录处理函数**

```typescript
const handleOneClickLogin = async () => {
  const result = await doOneClickLogin();
  if (result.success) {
    showModal('欢迎回来', '登录成功，祝您品茶愉快', 'success');
    setTimeout(() => router.back(), 800);
  } else if (result.error) {
    showModal('登录失败', result.error, 'error');
  }
  // 用户取消不显示任何提示
};
```

**Step 4: 在 UI 中添加一键登录按钮（邮箱输入框之前）**

在 `{/* Logo 区域 */}` 下方，`{/* 表单 */}` 之前添加：

```tsx
{/* 一键登录入口（仅支持时显示） */}
{isSupported && (
  <>
    <Pressable
      onPress={handleOneClickLogin}
      disabled={oneClickLoading}
      className="bg-primary rounded-full py-4 items-center justify-center active:bg-primary/90"
    >
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="phone-android" size={20} color="white" />
        <Text className="text-white font-medium text-base">
          {oneClickLoading ? '登录中...' : '本机号码一键登录'}
        </Text>
      </View>
    </Pressable>

    {/* 分隔线 */}
    <View className="flex-row items-center gap-3 my-2">
      <View className="flex-1 h-px bg-outline/30" />
      <Text className="text-outline text-xs">或</Text>
      <View className="flex-1 h-px bg-outline/30" />
    </View>
  </>
)}
```

---

## 阶段六：环境变量配置

### Task 11: 配置环境变量

**Files:**
- Modify: `.env`
- Modify: `.env.example`

**Step 1: 在 .env 中添加（实际值由用户填写）**

```env
# 阿里云一键登录配置
ALI_APP_KEY=your_ali_app_key_here
```

**Step 2: 在 .env.example 中添加占位符**

```env
# 阿里云一键登录配置
ALI_APP_KEY=
```

---

## 阶段七：验证与测试

### Task 12: 构建验证

**Step 1: iOS 构建验证**

```bash
# 检查 Podfile 配置
cat ios/Podfile | grep -A2 "AliOneClickLogin"

# 尝试构建（需要 Xcode）
xcodebuild -workspace ios/LijiteaApp.xcworkspace \
  -scheme LijiteaApp \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=iPhone 15" \
  build 2>&1 | tail -50
```

**Step 2: Android 构建验证**

```bash
# 检查模块配置
ls -la android/app/build.gradle | grep ali-one

# 构建 Debug APK
cd android && ./gradlew assembleDebug 2>&1 | tail -30
```

### Task 13: 功能测试清单

| 测试项 | 预期结果 | 实际结果 |
|--------|----------|----------|
| 一键登录按钮显示 | 仅在支持时显示 | ☐ |
| 点击按钮调起授权页 | 授权页正常拉起 | ☐ |
| 用户点击授权 | 获取 Token，登录成功 | ☐ |
| 用户取消授权 | 返回登录页，无错误提示 | ☐ |
| 网络不支持时 | 提示"不支持一键登录" | ☐ |
| 登录成功后跳转 | 返回原页面 | ☐ |
| 新用户首次登录 | 创建账号并登录 | ☐ |
| 老用户再次登录 | 关联已有账号并登录 | ☐ |

---

## 任务清单汇总

| # | 任务 | 类型 | 依赖 |
|---|------|------|------|
| 1 | 阿里云账号与产品开通 | 用户操作 | - |
| 2 | 配置 iOS 应用 | 用户操作 | 1 |
| 3 | 配置 Android 应用 | 用户操作 | 1 |
| 4 | 配置 Supabase Secrets | 用户操作 | 1 |
| 5 | 创建 Edge Function | 代码 | 4 |
| 6 | 创建 iOS Native Module | 代码 | 1,2 |
| 7 | 创建 Android Native Module | 代码 | 1,3 |
| 8 | 创建 TypeScript 桥接层 | 代码 | 6,7 |
| 9 | 创建 useOneClickLogin Hook | 代码 | 8 |
| 10 | 修改登录页 UI | 代码 | 9 |
| 11 | 配置环境变量 | 配置 | - |
| 12 | 构建验证 | 验证 | 5,6,7,8,9,10,11 |
| 13 | 功能测试 | 测试 | 12 |
