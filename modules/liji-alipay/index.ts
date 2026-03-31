/**
 * LijiAlipay Expo Native Module
 *
 * 本模块通过反射方式调用支付宝 Android SDK（com.alipay.sdk.app.PayTask），
 * 不需要在编译时直接依赖 SDK API，便于在缺少 AAR 时先完成 JS 层接线。
 *
 * 使用前确保：
 * 1. 已执行 npx expo prebuild --platform android
 * 2. 支付宝 AAR 已放入 modules/liji-alipay/android/libs/alipaySdk.aar
 * 3. 沙箱环境变量与服务端回调地址已完成配置
 */

// 本模块由 Kotlin 原生代码实现，JS 层通过 requireOptionalNativeModule("LijiAlipay") 调用。
export {};
