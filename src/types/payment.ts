export type PaymentChannel = "alipay" | "wechat" | "card";

export type OrderPaymentStatus =
  | "pending_payment"
  | "paying"
  | "success"
  | "failed"
  | "closed";

export interface TrackingEvent {
  status: string;
  title: string;
  detail: string;
  eventTime: string;
  sortOrder: number;
}

export interface AlipayCreateOrderResponse {
  orderString: string;
  outTradeNo: string;
  amount: string;
}

export interface PaymentOrderStatusResponse {
  orderId: string;
  status: string;
  paymentStatus: OrderPaymentStatus | null;
  outTradeNo: string | null;
  tradeNo: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  paymentErrorCode: string | null;
  paymentErrorMessage: string | null;
}

export interface MockPaymentConfirmResponse {
  orderId: string;
  status: string;
  paymentStatus: OrderPaymentStatus | null;
  paymentChannel: PaymentChannel;
  paidAt: string | null;
  paidAmount: number | null;
  outTradeNo: string | null;
  tradeNo: string | null;
  logisticsCompany: string | null;
  logisticsTrackingNo: string | null;
}

export interface AlipayNativePayResult {
  resultStatus: string;
  memo?: string;
  result?: string;
}
