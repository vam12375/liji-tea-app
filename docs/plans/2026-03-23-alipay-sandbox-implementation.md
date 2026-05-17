# 支付宝沙箱接入实施计划（Liji Tea App）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成支付宝沙箱 App 支付的端到端接入，包括服务端下单/回调、客户端状态机、原生 Android SDK 桥接、Expo prebuild 构建和沙箱联调验收。

**Architecture:** 采用"服务端签名 + 客户端发起 + 原生 SDK 调起 + 服务端验签回调"的闭环架构。服务端（Supabase Edge Functions Deno）负责私钥管理和支付单生成，客户端通过 Expo 原生模块反射调用支付宝 Android SDK，异步通知由服务端验签后更新数据库。

**Tech Stack:** Expo SDK 55, React Native 0.83.2, Supabase Edge Functions (Deno), Kotlin (原生模块), NativeWind, Zustand, Alipay Android SDK (沙箱版), RSA2 签名

---

## 前置条件检查

在开始之前，必须确认以下内容：

```bash
# 1. 检查 npm 依赖是否完整
npm install

# 2. 确认 Supabase CLI 已安装
npx supabase --version

# 3. 确认 Android Studio 已安装（用于构建 Android APK）
# 4. 确认已注册支付宝沙箱（https://open.alipaydev.com/）
```

---

## Phase 1：服务端沙箱密钥与环境配置

### Task 1: 获取支付宝沙箱凭证

**Files:**
- 参考: `docs/superpowers/specs/2026-03-23-alipay-sandbox-app-pay-design.md`
- 参考: `.env.example`
- 参考: `supabase/.env.local.example`

**Step 1: 注册支付宝沙箱**

1. 访问 https://open.alipaydev.com/ ，使用支付宝账号扫码登录沙箱环境。
2. 在「沙箱应用」中创建一个应用（或使用已有沙箱应用）。
3. 获取以下信息：
   - **App ID**（格式如 `2021001234567890`）
   - **应用私钥**（RSA2，PKCS8 格式 PEM）—— 生成方法见下方说明
   - **支付宝公钥**（上传应用公钥后获取）

**Step 2: 生成 RSA2 密钥对（如果尚未生成）**

```bash
# 使用 OpenSSL 生成 RSA2 私钥（PKCS8 格式）
openssl genrsa -out private_key.pem 2048
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private_key.pem -out private_key_pkcs8.pem
cat private_key_pkcs8.pem
# 保留此私钥内容，填入环境变量 ALIPAY_PRIVATE_KEY

# 导出公钥（用于上传到支付宝开放平台）
openssl rsa -in private_key.pem -pubout -out public_key.pem
cat public_key.pem
# 上传此公钥内容到沙箱应用页面，获取「支付宝公钥」
```

**Step 3: 配置 Supabase Secrets**

登录 Supabase Dashboard → Edge Functions → Secrets，添加以下密钥：

| 密钥名 | 值 |
|--------|-----|
| `ALIPAY_APP_ID` | 沙箱 App ID |
| `ALIPAY_PRIVATE_KEY` | RSA2 私钥（PEM 格式，多行保持 `\n` 转义） |
| `ALIPAY_PUBLIC_KEY` | 支付宝公钥 |
| `ALIPAY_GATEWAY` | `https://openapi-sandbox.dl.alipaydev.com/gateway.do` |
| `ALIPAY_NOTIFY_URL` | `https://your-ngrok-url.ngrok-free.app/functions/v1/alipay-notify` |

> **注意：** `ALIPAY_NOTIFY_URL` 必须为公网可访问的 HTTPS 地址。本地开发需要用 ngrok 穿透。

**Step 4: 配置本地 Edge Functions 环境**

```bash
# 复制环境变量模板
cp supabase/.env.local.example supabase/.env.local

# 编辑 supabase/.env.local，填入真实密钥值
code supabase/.env.local
```

**Step 5: 提交**

```bash
git add .env.example supabase/.env.local.example
git commit -m "docs: 添加支付宝环境变量配置模板"
```

---

## Phase 2：下载并放置支付宝 Android SDK

### Task 2: 下载支付宝 Android SDK

**Files:**
- 创建: `modules/liji-alipay/android/libs/alipaySdk.aar`
- 参考: `modules/liji-alipay/android/libs/README.md`

**Step 1: 下载 SDK**

1. 访问 https://opendocs.alipay.com/common/02kipk
2. 下载 Android SDK（建议使用 15.8.x 以上版本）
3. 解压获得 `alipaySdk-xxx.aar` 文件

**Step 2: 放置 AAR 文件**

```bash
# 将 AAR 复制到项目 libs 目录
cp 下载路径/alipaySdk-15.8.16.aar modules/liji-alipay/android/libs/alipaySdk.aar

# 确认文件存在
ls -lh modules/liji-alipay/android/libs/
# 预期输出：alipaySdk.aar (大小约 1-3MB)
```

**Step 3: 提交**

```bash
git add modules/liji-alipay/android/libs/alipaySdk.aar
git commit -m "feat(android): 添加支付宝 Android SDK AAR 文件"
```

---

## Phase 3：执行 Expo prebuild 生成 Android 原生项目

### Task 3: 执行 Expo prebuild

**Files:**
- 创建: `android/` 目录（Expo 生成）
- 验证: `android/settings.gradle` 包含 liji-alipay 模块
- 参考: `modules/liji-alipay/expo-module.config.json`

**Step 1: 清理旧的 android 目录（如存在）**

```bash
# 如果之前执行过 prebuild，先清理
rm -rf android

# 确认 modules/liji-alipay 配置正确
cat modules/liji-alipay/expo-module.config.json
# 预期输出包含 platforms: ["android"] 和正确的模块名
```

**Step 2: 执行 prebuild**

```bash
npx expo prebuild --platform android --clean

# 预期输出：
# - 生成 android/ 目录
# - 在 android/settings.gradle 中包含 include ':liji-alipay'
# - 在 android/app/build.gradle 中包含 implementation project(':liji-alipay')
# - 在 MainApplication 中注册了 LijiAlipayModule
```

**Step 3: 验证原生模块注册**

```bash
# 检查 settings.gradle 包含 liji-alipay
grep -n "liji-alipay" android/settings.gradle

# 检查 app/build.gradle 包含 liji-alipay 依赖
grep -n "liji-alipay" android/app/build.gradle

# 检查 MainApplication 包含模块注册
grep -n "LijiAlipay" android/app/src/main/java/com/lijitea/teaapp/MainApplication.*
```

**Step 4: 提交**

```bash
git add android/
git commit -m "feat(android): expo prebuild 生成原生 Android 项目并接入 liji-alipay 模块"
```

---

## Phase 4：构建并安装 Android APK

### Task 4: 配置 Android 签名

**Files:**
- 修改: `android/app/build.gradle`

**Step 1: 添加调试签名配置**

在 `android/app/build.gradle` 的 `android { }` 块中添加：

```groovy
android {
    // ... 现有配置 ...

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug  // 正式发布请使用正式签名
            minifyEnabled false
        }
    }
}
```

**Step 2: 确保 debug.keystore 存在**

```bash
# Android SDK 自带 debug.keystore，通常在 ~/.android/debug.keystore
# 如果不存在，生成一个：
# keytool -genkey -v -keystore android/app/debug.keystore -alias androiddebugkey \
#   -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android \
#   -dname "CN=Android Debug,O=Android,C=US"
```

**Step 3: 提交**

```bash
git add android/app/build.gradle
git commit -m "chore(android): 添加 debug 签名配置"
```

---

### Task 5: 构建 APK

**Files:**
- 构建产物: `android/app/build/outputs/apk/debug/app-debug.apk`

**Step 1: 使用 Expo 构建（推荐开发调试）**

```bash
npx expo run:android

# 或使用 EAS Build（真机测试推荐）
eas login
eas build --platform android --profile development --local

# 下载构建产物 APK
```

**Step 2: 直接使用 Gradle 构建**

```bash
cd android
./gradlew assembleDebug

# APK 输出位置
ls -lh app/build/outputs/apk/debug/
# 预期：app-debug.apk (大小约 30-80MB)
```

**Step 3: 安装到设备或模拟器**

```bash
# 连接 Android 设备（开启 USB 调试）
adb devices
# 预期输出：List of devices attached
#          xxxxxxxx    device

# 安装 APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 启动应用
adb shell am start -n com.liji.teaapp/.MainActivity
```

---

### Task 6: 安装支付宝沙箱钱包

**Files:**
- 无需修改代码

**Step 1: 在测试设备上安装沙箱钱包**

在 Android 设备上：
1. 在应用市场中搜索「支付宝沙箱」并安装
2. 或从支付宝沙箱下载页面下载 APK 并安装

**Step 2: 登录沙箱账号**

打开沙箱钱包，使用沙箱后台提供的测试账号登录。

**Step 3: 验证沙箱环境**

在沙箱后台 https://open.alipaydev.com/ 的「沙箱钱包」页面，可以查看测试交易。

---

## Phase 5：端到端沙箱联调

### Task 7: 启动本地服务

**Files:**
- 参考: `docs/superpowers/specs/2026-03-23-alipay-sandbox-implementation-plan.md`

**Step 1: 终端 1 - 启动 Supabase Edge Functions 本地服务**

```bash
npx supabase functions serve --env-file ./supabase/.env.local
# 保持运行状态，日志会显示函数调用情况
```

**Step 2: 终端 2 - 启动 ngrok 穿透**

```bash
# ngrok 需要单独安装：https://ngrok.com/download
# 安装后注册账号并配置 authtoken

ngrok config add-authtoken YOUR_AUTHTOKEN
ngrok http 54321

# 复制生成的 https://xxxx.ngrok-free.app 地址
# 更新 supabase/.env.local 中的 ALIPAY_NOTIFY_URL
# 重启 Edge Functions 服务
```

**Step 3: 终端 3 - 启动 Expo Metro**

```bash
npx expo start --dev-client

# 在设备上打开 Expo Go 并扫码，或使用模拟器
```

---

### Task 8: 执行端到端支付测试

**Files:**
- 测试入口: `src/app/payment.tsx`
- 验证日志: Supabase Edge Functions 服务端日志

**Step 1: 测试正常支付流程**

1. 在 App 中登录账号
2. 进入商城，选择商品，加入购物车
3. 进入购物车，点击结算
4. 选择或新增收货地址
5. 点击提交订单（创建 pending 订单）
6. 进入支付页，验证显示金额和订单号
7. 点击「确认支付」
8. 观察客户端日志：
   - ✅ `creating_order` → 服务端返回 `orderString`
   - ✅ `invoking_sdk` → SDK 调起
   - ✅ `waiting_confirm` → 轮询等待
   - ✅ `success` → 服务端确认

9. 在支付宝沙箱钱包中完成支付（模拟成功）
10. 验证 App 进入支付成功页

**Step 2: 测试用户取消场景**

1. 重复步骤 1-8
2. 在沙箱钱包中点击「取消」
3. 验证客户端进入 `failed` 状态
4. 验证订单状态仍为 `pending`（未被错误标记为 paid）

**Step 3: 测试 SDK 未安装场景（无 AAR）**

1. 临时将 AAR 文件移出：
   ```bash
   mv modules/liji-alipay/android/libs/alipaySdk.aar /tmp/
   ```
2. 重新 prebuild：
   ```bash
   npx expo prebuild --platform android --clean
   ```
3. 重新构建安装
4. 在支付页点击确认支付
5. 验证 JS 层抛出明确错误："未检测到支付宝 Android SDK"

**Step 4: 测试服务端验签失败场景**

1. 临时修改服务端代码，伪造验签失败
2. 在沙箱中完成支付
3. 验证服务端不更新订单状态
4. 验证 `payment_transactions.notify_verified = false` 记录在案

**Step 5: 提交**

```bash
git commit -m "test: 支付宝沙箱端到端联调验证通过"
```

---

## Phase 6：验收检查清单

### Task 9: 逐项验收

完成 Phase 5 后，对照以下标准逐项确认：

```bash
# 验收命令参考

# 1. 检查 payment_transactions 表有记录
# 在 Supabase Dashboard SQL Editor 中执行：
SELECT id, order_id, channel, status, notify_verified, created_at
FROM payment_transactions
ORDER BY created_at DESC
LIMIT 10;

# 2. 检查 orders 表支付字段已更新
SELECT id, status, payment_status, out_trade_no, paid_amount, paid_at
FROM orders
WHERE status = 'paid'
ORDER BY updated_at DESC
LIMIT 5;

# 3. 验证没有重复回调（幂等性）
SELECT out_trade_no, COUNT(*) as cnt
FROM payment_transactions
GROUP BY out_trade_no
HAVING COUNT(*) > 1;
# 预期：无结果（每笔交易只有一条记录）
```

**验收清单：**

- [ ] 服务端 `create-order` 返回有效的 `orderString`
- [ ] 原生 SDK 成功调起支付宝沙箱钱包
- [ ] 异步通知 `notify` 能被服务端接收
- [ ] 服务端验签通过（`notify_verified: true`）
- [ ] 订单从 `pending` → `paid`
- [ ] 客户端最终成功页展示服务端确认结果
- [ ] 重复 notify 不导致重复入账
- [ ] 金额不匹配时正确拒绝
- [ ] 用户取消后订单保持 `pending`

**Step 2: 提交**

```bash
git commit -m "chore: 支付宝沙箱接入 Phase 1-4 完成，验收通过"
```

---

## 快速命令参考（后续开发用）

```bash
# 拉取最新代码
git pull

# 安装依赖
npm install

# 启动本地 Edge Functions（含沙箱密钥）
npx supabase functions serve --env-file ./supabase/.env.local

# 启动 Expo Metro
npx expo start --dev-client

# 修改原生模块后重新生成 Android 项目
npx expo prebuild --platform android --clean

# 直接构建 APK
cd android && ./gradlew assembleDebug

# 部署 APK 到设备
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
