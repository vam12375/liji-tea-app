请将支付宝官方 Android SDK 的 AAR 文件放到当前目录，例如：
- `alipaySdk.aar`
- `alipaySdk-15.8.xx.aar`

接入步骤：
1. 从支付宝开放平台下载 Android SDK。
2. 将 AAR 文件复制到 `modules/liji-alipay/android/libs/`。
3. 执行 `npx expo prebuild --platform android`。
4. 执行 `npx expo run:android` 或使用 EAS development build。

说明：
- 当前原生模块通过反射调用 `com.alipay.sdk.app.PayTask`，因此在未放入 AAR 时也可以先完成代码接线。
- 但如果缺少 AAR，运行时会提示“未检测到支付宝 Android SDK”。
