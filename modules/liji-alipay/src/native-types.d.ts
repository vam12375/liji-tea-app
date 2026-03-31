/**
 * LijiAlipay 原生模块 TypeScript 类型声明。
 *
 * 定义 JS 层通过 requireOptionalNativeModule("LijiAlipay") 访问的接口，
 * 保持与 Kotlin 模块导出的方法一致。
 */

/** 支付宝 SDK App 支付结果 */
export interface AlipayNativePayResult {
  /** 状态码：9000=成功，6001=用户取消，8000=支付中，其他=失败 */
  resultStatus: string;
  /** 附加说明信息 */
  memo?: string;
  /** 原始结果串 */
  result?: string;
}

/** LijiAlipay 原生模块接口 */
export interface LijiAlipayNativeModule {
  /** 检查支付宝 SDK（PayTask 类）是否可用 */
  isAvailable(): boolean;
  /** 调起支付宝 App 支付 */
  pay(orderString: string): Promise<AlipayNativePayResult>;
}
