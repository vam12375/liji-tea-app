/**
 * 兼容旧版测试入口使用的支付阶段枚举。
 * 当前页面实现仍以 [`PaymentPhase`](src/components/payment/paymentConstants.ts:32) 为主，
 * 这里额外保留 `idle` 以兼容纯函数测试场景。
 */
export type PaymentPhase =
  | "idle"
  | "confirm"
  | "creating_order"
  | "invoking_sdk"
  | "waiting_confirm"
  | "success"
  | "failed";
