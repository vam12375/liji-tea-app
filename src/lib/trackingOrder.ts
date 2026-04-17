import {
  formatRemainingPaymentTime,
  getPendingPaymentDeadline,
} from "@/lib/orderTiming";
import type { Order } from "@/types/database";
import type { PaymentChannel } from "@/types/payment";

export interface TrackingActionFlags {
  canConfirmReceive: boolean;
  canRepay: boolean;
  remainingPaymentText: string | null;
}

// 支付页路由目前只接受项目内定义的支付渠道值。
export function normalizeTrackingPaymentChannel(
  paymentChannel?: string | null,
  paymentMethod?: string | null,
): PaymentChannel {
  const candidates = [paymentChannel, paymentMethod];

  for (const candidate of candidates) {
    if (
      candidate === "alipay" ||
      candidate === "wechat" ||
      candidate === "card"
    ) {
      return candidate;
    }
  }

  return "alipay";
}

// 订单动作可用性统一收口到这里，避免页面里散落多组状态判断。
export function getTrackingActionFlags(
  order: Order | null | undefined,
  now: number,
): TrackingActionFlags {
  if (!order) {
    return {
      canConfirmReceive: false,
      canRepay: false,
      remainingPaymentText: null,
    };
  }

  const canConfirmReceive = order.status === "shipping";
  const paymentDeadline = getPendingPaymentDeadline(order.created_at);
  const remainingPaymentMs =
    paymentDeadline === null ? null : paymentDeadline - now;
  const hasRemainingPaymentMs = typeof remainingPaymentMs === "number";
  const canRepay =
    order.status === "pending" && hasRemainingPaymentMs && remainingPaymentMs > 0;
  const remainingPaymentText =
    canRepay && hasRemainingPaymentMs
      ? formatRemainingPaymentTime(remainingPaymentMs)
      : null;

  return {
    canConfirmReceive,
    canRepay,
    remainingPaymentText,
  };
}
