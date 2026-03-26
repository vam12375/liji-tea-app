package com.lijitea.alioneclick

import android.util.Log
import com.alicom.fusion.auth.AlicomFusionAuthCallBack
import com.alicom.fusion.auth.AlicomFusionBusiness
import com.alicom.fusion.auth.HalfWayVerifyResult
import com.alicom.fusion.auth.error.AlicomFusionEvent
import com.alicom.fusion.auth.token.AlicomFusionAuthToken
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/**
 * 阿里云融合认证 Native Module
 *
 * 融合认证流程：
 * 1. 服务端获取鉴权 Token（由 JS 层通过 Supabase Edge Function 获取）
 * 2. 使用鉴权 Token 初始化 AlicomFusionBusiness
 * 3. 调起认证页面，获取 verifyToken
 * 4. 服务端用 verifyToken 调用 VerifyWithFusionAuthToken 获取手机号
 */
class AliOneClickModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var fusionBusiness: AlicomFusionBusiness? = null

    companion object {
        private const val TAG = "AliOneClickModule"
        const val ERR_USER_CANCEL = "E_USER_CANCEL"
        const val ERR_NO_ACTIVITY = "E_NO_ACTIVITY"
        const val ERR_NOT_INIT = "E_NOT_INIT"
        const val ERR_LOGIN_FAILED = "E_LOGIN_FAILED"
        const val ERR_NETWORK = "E_NETWORK_UNAVAILABLE"
    }

    override fun getName(): String = "AliOneClickModule"

    // ----------------------------------------------------------------
    // initWithToken — 使用服务端鉴权 Token 初始化融合认证 SDK
    // JS 层在调用 login 前必须先调用此方法
    // ----------------------------------------------------------------

    @ReactMethod
    fun initWithToken(authToken: String, promise: Promise) {
        scope.launch {
            try {
                val activity = currentActivity
                if (activity == null) {
                    promise.reject(ERR_NO_ACTIVITY, "无法获取当前 Activity")
                    return@launch
                }

                fusionBusiness?.release()
                fusionBusiness = AlicomFusionBusiness(activity)

                val fusionToken = AlicomFusionAuthToken(authToken)
                fusionBusiness!!.setToken(fusionToken)

                Log.d(TAG, "融合认证 SDK 初始化成功")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "融合认证 SDK 初始化失败: ${e.message}", e)
                promise.reject(ERR_NOT_INIT, "SDK 初始化失败: ${e.message}")
            }
        }
    }

    // ----------------------------------------------------------------
    // login — 调起融合认证页面，返回 verifyToken
    // ----------------------------------------------------------------

    @ReactMethod
    fun login(promise: Promise) {
        scope.launch {
            val business = fusionBusiness
            if (business == null) {
                promise.reject(ERR_NOT_INIT, "请先调用 initWithToken 初始化 SDK")
                return@launch
            }

            val activity = currentActivity
            if (activity == null) {
                promise.reject(ERR_NO_ACTIVITY, "无法获取当前 Activity")
                return@launch
            }

            try {
                val verifyToken = suspendCoroutine<String> { cont ->
                    business.startAuth(activity, object : AlicomFusionAuthCallBack {
                        override fun onVerifySuccess(verifyToken: String) {
                            Log.d(TAG, "融合认证成功，verifyToken 已获取")
                            cont.resume(verifyToken)
                        }

                        override fun onVerifyFailed(
                            event: AlicomFusionEvent?,
                            halfWayVerifyResult: HalfWayVerifyResult?
                        ) {
                            val code = event?.resultCode ?: ""
                            val desc = event?.resultDesc ?: "认证失败"
                            Log.w(TAG, "融合认证失败: code=$code, desc=$desc")

                            // 用户主动取消（点击返回键）
                            if (code == "700000" || desc.contains("取消")) {
                                cont.resumeWithException(
                                    ReactNativeException(ERR_USER_CANCEL, "用户取消")
                                )
                            } else {
                                cont.resumeWithException(
                                    ReactNativeException(ERR_LOGIN_FAILED, desc)
                                )
                            }
                        }

                        override fun onCancel() {
                            Log.d(TAG, "用户取消融合认证")
                            cont.resumeWithException(
                                ReactNativeException(ERR_USER_CANCEL, "用户取消")
                            )
                        }
                    })
                }

                val result = Arguments.createMap().apply {
                    putString("verifyToken", verifyToken)
                }
                promise.resolve(result)

            } catch (e: ReactNativeException) {
                promise.reject(e.code, e.message)
            } catch (e: Exception) {
                Log.e(TAG, "login 异常: ${e.message}", e)
                promise.reject(ERR_LOGIN_FAILED, e.message ?: "未知错误")
            }
        }
    }

    // ----------------------------------------------------------------
    // quit — 释放融合认证 SDK 资源
    // ----------------------------------------------------------------

    @ReactMethod
    fun quit(promise: Promise) {
        try {
            fusionBusiness?.release()
            fusionBusiness = null
            promise.resolve(null)
        } catch (e: Exception) {
            Log.w(TAG, "quit 异常: ${e.message}")
            promise.resolve(null)
        }
    }

    override fun onCatalystInstanceDestroy() {
        scope.cancel()
        fusionBusiness?.release()
        fusionBusiness = null
    }

    // 内部异常类，携带错误码
    private class ReactNativeException(val code: String, message: String) : Exception(message)
}
