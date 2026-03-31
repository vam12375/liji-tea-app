package com.lijitea.alioneclick

import android.app.Activity
import android.content.Context
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
 * 阿里云融合认证 Native Module（适配 fusionauth-1.2.14）
 *
 * 融合认证流程：
 * 1. JS 层通过 Supabase Edge Function 获取服务端鉴权 Token
 * 2. 调用 initWithToken 初始化 SDK
 * 3. 调用 login(templateId) 调起认证页面，获取 verifyToken
 * 4. 服务端用 verifyToken 换取手机号
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
    }

    override fun getName(): String = "AliOneClickModule"

    // ----------------------------------------------------------------
    // initWithToken — 使用服务端鉴权 Token 初始化融合认证 SDK
    // appId 由 BuildConfig.ALI_APP_KEY 注入，无需 JS 层传入
    // ----------------------------------------------------------------

    @ReactMethod
    fun initWithToken(authToken: String, promise: Promise) {
        val activity = reactApplicationContext.currentActivity as? Activity
        scope.launch {
            try {
                if (activity == null) {
                    promise.reject(ERR_NO_ACTIVITY, "无法获取当前 Activity")
                    return@launch
                }

                fusionBusiness?.destory()

                val business = AlicomFusionBusiness()
                val token = AlicomFusionAuthToken().apply { setAuthToken(authToken) }
                val appId = BuildConfig.ALI_APP_KEY

                business.initWithToken(activity, appId, token)
                fusionBusiness = business

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
    // templateId 由服务端配置，JS 层传入
    // ----------------------------------------------------------------

    @ReactMethod
    fun login(templateId: String, promise: Promise) {
        val activity = reactApplicationContext.currentActivity as? Activity
        scope.launch {
            val business = fusionBusiness
            if (business == null) {
                promise.reject(ERR_NOT_INIT, "请先调用 initWithToken 初始化 SDK")
                return@launch
            }

            if (activity == null) {
                promise.reject(ERR_NO_ACTIVITY, "无法获取当前 Activity")
                return@launch
            }

            try {
                val verifyToken = suspendCoroutine<String> { cont ->
                    business.setAlicomFusionAuthCallBack(object : AlicomFusionAuthCallBack {

                        override fun onSDKTokenUpdate(): AlicomFusionAuthToken? = null

                        override fun onSDKTokenAuthSuccess() {
                            Log.d(TAG, "SDK Token 鉴权成功")
                        }

                        override fun onSDKTokenAuthFailure(
                            token: AlicomFusionAuthToken?,
                            event: AlicomFusionEvent?
                        ) {
                            val code = event?.errorCode ?: ""
                            val msg = event?.errorMsg ?: "Token 鉴权失败"
                            Log.e(TAG, "SDK Token 鉴权失败: code=$code, msg=$msg")
                            cont.resumeWithException(RNException(ERR_NOT_INIT, msg))
                        }

                        override fun onVerifySuccess(
                            verifyToken: String?,
                            phoneNumber: String?,
                            event: AlicomFusionEvent?
                        ) {
                            Log.d(TAG, "融合认证成功，verifyToken 已获取")
                            cont.resume(verifyToken ?: "")
                        }

                        override fun onHalfWayVerifySuccess(
                            verifyToken: String?,
                            phoneNumber: String?,
                            event: AlicomFusionEvent?,
                            halfWayVerifyResult: HalfWayVerifyResult?
                        ) {
                            // 半程验证成功，同样视为成功
                            Log.d(TAG, "半程认证成功")
                            cont.resume(verifyToken ?: "")
                        }

                        override fun onVerifyFailed(
                            event: AlicomFusionEvent?,
                            templateId: String?
                        ) {
                            val code = event?.errorCode ?: ""
                            val msg = event?.errorMsg ?: "认证失败"
                            Log.w(TAG, "融合认证失败: code=$code, msg=$msg")
                            if (code == "700000" || msg.contains("取消")) {
                                cont.resumeWithException(RNException(ERR_USER_CANCEL, "用户取消"))
                            } else {
                                cont.resumeWithException(RNException(ERR_LOGIN_FAILED, msg))
                            }
                        }

                        override fun onTemplateFinish(event: AlicomFusionEvent?) {
                            Log.d(TAG, "模板完成: ${event?.errorCode}")
                        }

                        override fun onAuthEvent(event: AlicomFusionEvent?) {
                            Log.d(TAG, "认证事件: ${event?.errorCode}")
                        }

                        override fun onGetPhoneNumberForVerification(
                            phoneNumber: String?,
                            event: AlicomFusionEvent?
                        ): String? = null

                        override fun onVerifyInterrupt(event: AlicomFusionEvent?) {
                            val code = event?.errorCode ?: ""
                            Log.w(TAG, "认证中断: code=$code")
                            cont.resumeWithException(RNException(ERR_USER_CANCEL, "认证中断"))
                        }
                    })

                    business.startSceneWithTemplateId(activity, templateId)
                }

                val result = Arguments.createMap().apply {
                    putString("verifyToken", verifyToken)
                }
                promise.resolve(result)

            } catch (e: RNException) {
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
            fusionBusiness?.destory()
            fusionBusiness = null
            promise.resolve(null)
        } catch (e: Exception) {
            Log.w(TAG, "quit 异常: ${e.message}")
            promise.resolve(null)
        }
    }

    override fun onCatalystInstanceDestroy() {
        scope.cancel()
        fusionBusiness?.destory()
        fusionBusiness = null
    }

    private class RNException(val code: String, message: String) : Exception(message)
}
