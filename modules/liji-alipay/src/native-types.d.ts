/**
 * LijiAlipay 原生模块 TypeScript 类型声明
 *
 * 定义 JS 层通过 requireOptionalNativeModule("LijiAlipay") 访问的接口。
 * 此类型与 android/src/main/java/com/lijitea/alipay/LijiAlipayModule.kt 对齐。
 */

/** 支付宝 SDK App 支付结果 */
export interface AlipayNativePayResult {
  /** 状态码：9000=成功，6001=用户取消，8000=支付中，其他=失败 */
  resultStatus: string;
  /** 附加说明信息 */
  memo?: string;
  /** 原始结果串（包含 resultStatus、sign 等） */
  result?: string;
}

/** LijiAlipay 原生模块接口（与 Kotlin LijiAlipayModule 对齐） */
export interface LijiAlipayNativeModule {
  /** 检查支付宝 SDK（PayTask 类）是否可用 */
  isAvailable(): boolean;
  /** 调起支付宝 App 支付 */
  pay(orderString: string): Promise<AlipayNativePayResult>;
}

/**
 * 已知的 resultStatus 值说明：
 * - "9000": 支付成功
 * - "8000": 支付结果确认中（需轮询状态）
 * - "6001": 用户取消支付
 * - "6002": 网络异常
 * - "4000": 订单参数无效
 * - "5000": 重复请求
 */
