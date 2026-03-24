/**
 * LijiAlipay Expo Native Module
 *
 * 本模块通过反射方式调用支付宝 Android SDK（com.alipay.sdk.app.PayTask），
 * 不需要在 libs 中放入 AAR 也能完成 JS 层的代码接线。
 * 运行时如缺少 AAR，isAvailable() 会返回 false，JS 层会优雅降级。
 *
 * Expo Autolinking 入口：
 * - nativeModulesDir: ./modules（已在 package.json expo.autolinking 中配置）
 * - expo-module.config.json: platforms=["android"], modules=["com.lijitea.alipay.LijiAlipayModule"]
 *
 * 使用前确保：
 * 1. 已执行 npx expo prebuild --platform android
 * 2. 支付宝 AAR 已放入 modules/liji-alipay/android/libs/alipaySdk.aar
 * 3. 沙箱环境变量已在 .env.local 中配置
 */

// 本模块由 Kotlin 原生代码实现（LijiAlipayModule.kt），无需 JS 端入口文件。
// JS 层通过 requireOptionalNativeModule("LijiAlipay") 访问原生方法。
export {};

