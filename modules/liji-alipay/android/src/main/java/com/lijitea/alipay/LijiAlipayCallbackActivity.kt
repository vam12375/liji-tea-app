package com.lijitea.alipay

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity

/**
 * 支付宝回跳兜底 Activity。
 *
 * 当前主链路依赖 payV2 的同步结果，这个 Activity 只保留为极少数回跳场景兜底，
 * 不承担正式的支付结果判断职责。
 */
class LijiAlipayCallbackActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val callbackIntent = intent?.data?.let { data ->
      Intent(Intent.ACTION_VIEW).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        this.data = data
      }
    }

    if (callbackIntent != null) {
      startActivity(callbackIntent)
    }

    finish()
  }
}
