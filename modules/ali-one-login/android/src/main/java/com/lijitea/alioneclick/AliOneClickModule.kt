package com.lijitea.alioneclick

import android.Manifest
import android.content.pm.PackageManager
import android.telephony.TelephonyManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*

/**
 * 阿里云一键登录 Native Module
 *
 * 职责（SOLID-Single）：只负责与阿里云 SDK 的通信和 Token 获取
 * 验证逻辑交给 Supabase Edge Function 处理，保持模块职责单一
 *
 * 遵循 KISS：直接暴露 4 个核心方法，无过度封装
 * 遵循 YAGNI：暂不实现复杂缓存和重试逻辑
 */
class AliOneClickModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    // 协程作用域：使用 Main + SupervisorJob，确保协程在组件销毁时正确清理
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // 当前持有的 Token 缓存（避免重复获取）
    private var cachedToken: String? = null

    // 日志标签
    companion object {
        private const val TAG = "AliOneClickModule"
        // 错误码：用户取消授权
        const val ERR_USER_CANCEL = "E_USER_CANCEL"
        // 错误码：Activity 不可用
        const val ERR_NO_ACTIVITY = "E_NO_ACTIVITY"
        // 错误码：SDK 未初始化
        const val ERR_NOT_INIT = "E_NOT_INIT"
        // 错误码：登录失败
        const val ERR_LOGIN_FAILED = "E_LOGIN_FAILED"
    }

    /**
     * 返回模块名称，供 React Native 侧 NativeModules 调用
     */
    override fun getName(): String = "AliOneClickModule"

    /**
     * 检查当前网络环境是否支持一键登录
     *
     * 检测逻辑：
     * 1. 检查是否有 READ_PHONE_STATE 权限
     * 2. 检查 SIM 卡是否插入
     * 3. 检查当前运营商是否支持一键登录（移动/联通/电信）
     *
     * @param promise Promise.resolve(true/false)
     */
    @ReactMethod
    fun checkEnvAvailable(promise: Promise) {
        scope.launch {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.resolve(false)
                    return@launch
                }

                val pm = activity.packageManager
                val context = reactApplicationContext

                // 检查权限
                val hasPermission = pm.checkPermission(
                    Manifest.permission.READ_PHONE_STATE,
                    context.packageName
                ) == PackageManager.PERMISSION_GRANTED

                if (!hasPermission) {
                    Log.w(TAG, "缺少 READ_PHONE_STATE 权限，无法检测运营商环境")
                    promise.resolve(false)
                    return@launch
                }

                // 检查运营商
                val telephonyManager = context.getSystemService(TelephonyManager::class.java)
                val operator = telephonyManager.simOperator

                if (operator.isNullOrEmpty()) {
                    Log.w(TAG, "未检测到 SIM 卡或运营商")
                    promise.resolve(false)
                    return@launch
                }

                // 判断运营商：中国移动 46000/46002/46007，中国联通 46001/46006，中国电信 46003/46005/46011
                val supportedOperators = listOf("46000", "46001", "46002", "46003", "46005", "46006", "46007", "46011")
                val isSupported = operator.take(5) in supportedOperators

                Log.d(TAG, "运营商代码: $operator, 支持一键登录: $isSupported")
                promise.resolve(isSupported)

            } catch (e: Exception) {
                Log.e(TAG, "checkEnvAvailable 异常: ${e.message}", e)
                promise.resolve(false)
            }
        }
    }

    /**
     * 预取 Token，加速授权页拉起速度
     *
     * 建议在页面加载时调用，登录时直接拉起授权页
     *
     * @param promise Promise.resolve()
     */
    @ReactMethod
    fun prefetchToken(promise: Promise) {
        scope.launch {
            try {
                Log.d(TAG, "prefetchToken: 预取 Token（占位实现）")
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "prefetchToken 异常: ${e.message}", e)
                promise.reject(ERR_LOGIN_FAILED, "预取 Token 失败: ${e.message}", e)
            }
        }
    }

    /**
     * 调起一键登录授权页，获取 Token
     *
     * 核心流程：
     * 1. 获取当前 Activity 作为授权页容器
     * 2. 调起阿里云 SDK 授权页
     * 3. 用户确认后返回 Token
     * 4. Token 传至 Supabase Edge Function 完成最终验证
     *
     * @param promise Promise.resolve({ token, phoneNumber }) 或 Promise.reject(errorCode, message)
     */
    @ReactMethod
    fun login(promise: Promise) {
        scope.launch {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject(ERR_NO_ACTIVITY, "无法获取 Activity，请确保在真机上运行", null)
                    return@launch
                }

                // 获取阿里云 AppKey
                val appKey = getAppKey()
                if (appKey.isNullOrEmpty()) {
                    Log.w(TAG, "ALI_APP_KEY 未配置，跳过真实 SDK 调用（调试模式）")
                    // 调试模式：模拟返回一个假 Token
                    val mockResult = Arguments.createMap().apply {
                        putString("token", "MOCK_TOKEN_DEBUG")
                        putString("phoneNumber", "138****0000")
                    }
                    promise.resolve(mockResult)
                    return@launch
                }

                // TODO: 接入真实阿里云 SDK 后，替换为真实 SDK 调用
                // 当前为占位实现
                Log.d(TAG, "login: 调起一键登录授权页（占位实现）")
                val result = Arguments.createMap().apply {
                    putString("token", "PLACEHOLDER_TOKEN")
                    putString("phoneNumber", "138****0000")
                }
                promise.resolve(result)

            } catch (e: Exception) {
                Log.e(TAG, "login 异常: ${e.message}", e)
                promise.reject(ERR_LOGIN_FAILED, "一键登录失败: ${e.message}", e)
            }
        }
    }

    /**
     * 退出登录，释放 SDK 资源
     *
     * @param promise Promise.resolve()
     */
    @ReactMethod
    fun quit(promise: Promise) {
        try {
            cachedToken = null
            Log.d(TAG, "quit: 释放 SDK 资源")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "quit 异常: ${e.message}", e)
            promise.reject(ERR_LOGIN_FAILED, "退出失败: ${e.message}", e)
        }
    }

    /**
     * 发送事件到 React Native 侧
     */
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    /**
     * 获取阿里云 AppKey
     *
     * 优先级：BuildConfig > Manifest meta-data
     */
    private fun getAppKey(): String? {
        return try {
            val buildConfigClass = Class.forName("com.lijitea.alioneclick.BuildConfig")
            val field = buildConfigClass.getField("ALI_APP_KEY")
            field.get(null) as? String
        } catch (e: Exception) {
            val context = reactApplicationContext
            context.packageManager
                .getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
                .metaData
                .getString("com.aliyun.aliyun.APP_KEY")
        }
    }

    /**
     * 组件销毁时清理协程
     */
    override fun invalidate() {
        scope.cancel()
        super.invalidate()
    }
}
