package com.lijitea.alipay

import android.app.Activity
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.withContext

class LijiAlipayModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LijiAlipay")

    Function("isAvailable") {
      isAlipaySdkAvailable()
    }

    AsyncFunction("pay") Coroutine { orderString: String ->
      if (orderString.isBlank()) {
        throw IllegalArgumentException("orderString 不能为空。")
      }

      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()

      return@Coroutine withContext(appContext.backgroundCoroutineScope.coroutineContext) {
        val payTaskClass = loadPayTaskClass()
        val payTask = payTaskClass.getConstructor(Activity::class.java).newInstance(activity)
        val payMethod = payTaskClass.getMethod(
          "payV2",
          String::class.java,
          java.lang.Boolean.TYPE
        )
        val rawResult = payMethod.invoke(payTask, orderString, true) as? Map<*, *>
          ?: throw IllegalStateException("支付宝 SDK 返回结果格式异常。")

        mapOf(
          "resultStatus" to rawResult["resultStatus"]?.toString().orEmpty(),
          "memo" to rawResult["memo"]?.toString(),
          "result" to rawResult["result"]?.toString()
        )
      }
    }
  }

  private fun isAlipaySdkAvailable(): Boolean {
    return runCatching {
      Class.forName(PAY_TASK_CLASS_NAME)
    }.isSuccess
  }

  private fun loadPayTaskClass(): Class<*> {
    return runCatching {
      Class.forName(PAY_TASK_CLASS_NAME)
    }.getOrElse { error ->
      throw IllegalStateException(
        "未检测到支付宝 Android SDK，请先将官方 AAR 放入 modules/liji-alipay/android/libs。",
        error
      )
    }
  }

  private companion object {
    const val PAY_TASK_CLASS_NAME = "com.alipay.sdk.app.PayTask"
  }
}
