package com.lijitea.alipay

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity

/**
 * 支付宝 App 支付回调 Activity。
 *
 * 用途说明：
 * - 对于纯 App 支付（PayTask.payV2），支付宝 SDK 使用内部跳转，
 *   支付结果通过 API 直接返回，无需此 Activity 处理。
 * - 此 Activity 主要用于以下场景兜底：
 *   1. 某些特殊网络环境下，支付宝客户端通过 scheme 跳转回本 App
 *   2. H5 支付场景的回调处理
 *   3. 兼容部分旧版支付宝 SDK 行为
 *
 * 如果 App 仅使用 PayTask.payV2 且确认不需要 H5 支付支持，
 * 可以从 AndroidManifest.xml 中移除此 Activity 的注册，
 * 并删除此文件。
 */
class LijiAlipayCallbackActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // 将回调数据转发给 AlipayModule 处理
    val intent = Intent(Intent.ACTION_VIEW).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      data = intent?.data
    }

    // 启动主界面，让用户感知到跳转回来了
    if (intent != null) {
      startActivity(intent)
    }

    finish()
  }
}
