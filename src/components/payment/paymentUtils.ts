import type { PaymentChannel } from "@/types/payment";

// 路由参数里的金额是字符串，这里统一转成可安全展示的 number。
export function parseAmount(value?: string) {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

// 校验路由传入的支付方式，避免非法值进入后续支付流程。
export function isPaymentChannel(
  value: string | undefined,
): value is PaymentChannel {
  return value === "alipay" || value === "wechat" || value === "card";
}
