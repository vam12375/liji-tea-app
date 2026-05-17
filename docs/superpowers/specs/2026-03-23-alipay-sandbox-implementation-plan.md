# 支付宝沙箱接入实施计划（Liji Tea App）

- 日期：2026-03-23
- 项目：liji-tea-app
- 目标：完成 Phase 1-4，从设计到沙箱联调验收
- 推荐执行模式：按顺序执行，每次完成一个 Phase 后验证

---

## 前置条件检查

在开始之前，确保以下内容已就绪：

- [ ] 已注册支付宝开放平台账号（沙箱）
- [ ] 已安装 Android Studio（用于构建 Android APK）
- [ ] Node.js >= 18
- [ ] 已安装 `ngrok` 或类似内网穿透工具（用于本地 notify_url）
- [ ] `npm install` 已执行，项目依赖完整

---

## Phase 1：配置沙箱密钥与环境变量

### 1.1 获取支付宝沙箱凭证

1. 登录 [支付宝开放平台沙箱](https://open.alipaydev.com/)，使用支付宝账号扫码进入沙箱环境。
2. 在「沙箱应用」中创建或选择一个应用，获取：
   - **App ID**（格式如 `2021001234567890`）
   - **应用私钥**（RSA2，PKCS8 格式）
   - **应用公钥**（上传到沙箱后获取）
   - **支付宝公钥**（用于验签回调）
3. 沙箱网关地址固定为：
   ```
   https://openapi-sandbox.dl.alipaydev.com/gateway.do
   ```

### 1.2 配置环境变量

#### 服务端（Supabase Edge Functions）

在 Supabase Dashboard → Edge Functions → Secrets 中添加以下密钥：

| 密钥名 | 说明 |
|--------|------|
| `ALIPAY_APP_ID` | 沙箱 App ID |
| `ALIPAY_PRIVATE_KEY` | RSA2 私钥（PEM 格式） |
| `ALIPAY_PUBLIC_KEY` | 支付宝公钥（用于验签） |
| `ALIPAY_GATEWAY` | `https://openapi-sandbox.dl.alipaydev.com/gateway.do` |
| `ALIPAY_NOTIFY_URL` | 回调地址（见 1.3） |
| `ALIPAY_SELLER_ID` | 沙箱卖家 PID（可选） |
| `SUPABASE_URL` | 已有 |
| `SUPABASE_SERVICE_ROLE_KEY` | 已有 |
| `SUPABASE_ANON_KEY` | 已有 |

本地开发时，可复制 `supabase/.env.local.example` 为 `supabase/.env.local` 并填入值后使用。

#### 客户端（Expo 环境变量）

在 `.env` 中添加：

```bash
EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED=true
EXPO_PUBLIC_PAYMENT_ENV=sandbox
```

### 1.3 配置 notify_url（异步回调地址）

支付完成后，支付宝会向服务端发送异步通知。该地址必须是公网可访问的 HTTPS 地址。

**本地开发方案**：
```bash
# 启动 ngrok 转发 Supabase Edge Functions 端口
npx supabase functions serve --env-file ./supabase/.env.local
# 在另一个终端
ngrok http 54321
# ngrok 会生成形如 https://xxxx.ngrok-free.app 的公网地址

# 回调地址格式：
ALIPAY_NOTIFY_URL=https://xxxx.ngrok-free.app/functions/v1/alipay-notify
```

**线上部署后**：
直接使用实际的域名地址。

### 1.4 配置数据库

确保数据库迁移已执行：

```bash
# 使用 Supabase CLI 或在 Dashboard 中执行以下迁移：
# supabase/migrations/202603230001_add_alipay_payment_fields.sql
```

验证 `payment_transactions` 表存在：
```sql
SELECT * FROM payment_transactions LIMIT 1;
```

---

## Phase 2：下载并放置支付宝 Android SDK

### 2.1 下载 SDK

1. 访问 [支付宝开放平台文档中心](https://opendocs.alipay.com/common/02kipk)，下载 Android SDK。
2. 解压后获得 `alipaySdk-xxx.aar` 文件（建议使用 15.8.x 以上版本）。

### 2.2 放置 AAR 文件

```bash
# 将下载的 AAR 文件重命名为 alipaySdk.aar（可选）并放入：
cp alipaySdk-15.8.16.aar modules/liji-alipay/android/libs/alipaySdk.aar
```

### 2.3 验证反射调用可用性

SDK 放入后，`LijiAlipayModule.isAvailable()` 会返回 `true`。可以在 JS 层打印验证：
```ts
import { isAlipayNativeModuleAvailable } from '@/lib/alipayNative';
console.log('Alipay SDK available:', isAlipayNativeModuleAvailable());
```

---

## Phase 3：执行 Expo prebuild 生成 Android 原生项目

> ⚠️ 此步骤会生成 `android/` 目录，**不要**手动修改其中的文件。所有原生配置应在 `modules/` 和 `app.json` 中完成。

### 3.1 确认本地配置

检查 `package.json` 中的配置：
```json
{
  "expo": {
    "autolinking": {
      "nativeModulesDir": "./modules"
    }
  }
}
```

### 3.2 执行 prebuild

```bash
# 清理旧的 android 目录（如果有）
rm -rf android

# 生成 Android 原生项目
npx expo prebuild --platform android --clean

# 预期输出：创建 android/ 目录，包含完整的原生项目结构
```

### 3.3 验证原生模块已接入

prebuild 后检查 `android/settings.gradle`，确认包含：
```groovy
include ':app'
include ':liji-alipay'
project(':liji-alipay').projectDir = new File(rootProject.projectDir, '../modules/liji-alipay/android')
```

### 3.4 配置 Android 签名（可选，本地调试用）

在 `android/app/build.gradle` 中添加调试签名配置：

```groovy
android {
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
            signingConfig signingConfig.debug  // 正式发布请换正式签名
        }
    }
}
```

---

## Phase 4：构建与安装 Android APK

### 4.1 方案 A：本地构建

```bash
# 确保设备已连接或模拟器已启动
npx expo run:android

# 或使用 gradle 直接构建
cd android
./gradlew assembleDebug
```

APK 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

### 4.2 方案 B：EAS Build（推荐用于真机测试）

```bash
# 登录 Expo 账号（如尚未登录）
eas login

# 配置 EAS Build（如尚未配置）
eas build:configure

# 构建 Android APK
eas build --platform android --profile development

# 下载 APK 并安装到真机
```

### 4.3 安装支付宝沙箱钱包

在测试设备上安装「支付宝沙箱」应用（可在各应用市场搜索，或使用 adb 安装沙箱 APK）。

沙箱钱包使用独立的沙箱账号登录，可以在沙箱后台查看测试交易。

---

## Phase 5：端到端沙箱联调

### 5.1 启动本地服务

```bash
# 终端 1：启动 Supabase Edge Functions 本地服务
npx supabase functions serve --env-file ./supabase/.env.local

# 终端 2：启动 ngrok
ngrok http 54321
# 复制生成的 https://xxxx.ngrok-free.app 地址，更新 .env.local 中的 ALIPAY_NOTIFY_URL

# 终端 3：启动 Expo Metro
npx expo start --dev-client
```

### 5.2 完整支付流程测试

1. 在 App 中选择商品，加入购物车
2. 进入结算页，选择地址，提交订单
3. 进入支付页，点击「确认支付」
4. 观察日志：
   - ✅ 服务端 `create-order` 返回 `orderString`
   - ✅ 原生 SDK 成功调起（`resultStatus === 9000`）
   - ✅ 轮询订单状态变化
5. 在沙箱钱包中完成支付（模拟成功/取消/失败）
6. 检查 `payment_transactions` 表是否有记录
7. 检查 `orders` 表 `payment_status` 是否为 `success`

### 5.3 异常场景测试

| 场景 | 操作 | 预期结果 |
|------|------|---------|
| 用户取消支付 | 沙箱中点「取消」 | SDK 返回 `6001`，页面进入 failed |
| SDK 未安装 | 不放 AAR 执行 prebuild | `isAvailable()` 返回 `false` |
| 验签失败 | 篡改 notify payload | 服务端返回 `failure`，不更新订单 |
| 金额不匹配 | 修改回调金额 | 服务端拒绝，更新 `payment_status` 为 `failed` |
| 重复回调 | 同一交易多次通知 | 幂等处理，不重复入账 |
| 网络异常 | 关闭 ngrok | 支付宝会重试 notify |

---

## Phase 6：验收检查清单

完成 Phase 5 后，对照以下标准逐项确认：

- [ ] **服务端 `create-order`**：客户端能拿到正确的 `orderString`
- [ ] **原生 SDK 调起**：支付宝沙箱钱包成功拉起
- [ ] **异步通知到达**：支付宝能访问 `notify_url`
- [ ] **验签通过**：服务端日志显示 `notify_verified: true`
- [ ] **订单状态更新**：订单从 `pending` → `paid`
- [ ] **客户端最终确认**：支付成功页展示服务端确认结果
- [ ] **幂等性**：重复 notify 不会导致重复入账
- [ ] **金额校验**：金额不匹配时正确拒绝
- [ ] **取消处理**：用户取消后订单保持 `pending`，不错误标记为成功

---

## Phase 7：后续扩展（不在本次范围）

- [ ] 正式环境商户切换（沙箱 → 正式）
- [ ] 微信支付接入
- [ ] iOS 支付接入
- [ ] 退款功能
- [ ] 对账系统
- [ ] 支付超时自动关闭订单（Cron Job）

---

## 快速命令参考

```bash
# 1. 拉取最新代码
git pull

# 2. 安装依赖
npm install

# 3. 启动本地 Edge Functions
npx supabase functions serve --env-file ./supabase/.env.local

# 4. 启动 Metro
npx expo start --dev-client

# 5. 重新生成 Android 项目（模块修改后）
npx expo prebuild --platform android --clean

# 6. 直接构建 APK
cd android && ./gradlew assembleDebug
```
