import { track } from "@/lib/analytics";
import { fetchPaymentOrderStatus } from "@/lib/alipay";
import { cancelPendingOrderAndRestoreStock } from "@/lib/order";
import { isPendingOrderExpired } from "@/lib/orderTiming";
import { captureError } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/types/database";

/** 超时待支付订单在客户端展示为关闭时使用的统一提示文案。 */
const EXPIRED_PENDING_ORDER_MESSAGE =
  "待付款订单已超过 10 分钟，系统已自动取消。";

/** 订单写操作的统一返回结构，便于 store 收口成功更新和错误提示。 */
export interface OrderMutationResult {
  update: Partial<Order> | null;
  error: string | null;
}

/** 客户端不直接写关闭状态，仅在本地把超时待支付订单映射成关闭展示。 */
export function createExpiredPendingOrderUpdate(
  now = new Date().toISOString(),
): Partial<Order> {
  return {
    status: "cancelled",
    payment_status: "closed",
    payment_error_code: "order_expired",
    payment_error_message: EXPIRED_PENDING_ORDER_MESSAGE,
    updated_at: now,
  };
}

/**
 * 待付款订单一旦在客户端被判定为超时，优先调用服务端支付状态接口。
 * 这样可以真正触发服务端的关单、释放库存、释放 locked 优惠券逻辑，
 * 避免前端只把订单“显示成已取消”，但数据库里的优惠券仍保持 locked。
 */
export async function applyExpiredPendingOrderState(order: Order): Promise<Order> {
  if (!isPendingOrderExpired(order)) {
    return order;
  }

  try {
    const remoteStatus = await fetchPaymentOrderStatus(order.id);

    if (
 remoteStatus.status === "cancelled" ||
      remoteStatus.paymentStatus === "closed" ||
      remoteStatus.paymentStatus === "failed"
    ) {
      return {
        ...order,
        status: remoteStatus.status === "cancelled" ? "cancelled" : order.status,
        payment_status: remoteStatus.paymentStatus ?? "closed",
        payment_error_code: remoteStatus.paymentErrorCode,
        payment_error_message:
 remoteStatus.paymentErrorMessage ?? EXPIRED_PENDING_ORDER_MESSAGE,
        updated_at: new Date().toISOString(),
      };
    }
  } catch (error: unknown) {
    captureError(error, {
      scope: "orderActions",
      message: "调用 payment-order-status 触发超时订单关单失败，回退到本地过期映射",
      orderId: order.id,
    });
  }

  return {
    ...order,
    ...createExpiredPendingOrderUpdate(),
  };
}

/** 取消订单动作封装：统一处理埋点、异常捕获与本地可合并更新。 */
export async function cancelOrderAction(
  orderId: string,
  userId: string,
): Promise<OrderMutationResult> {
  try {
    const now = new Date().toISOString();
    await cancelPendingOrderAndRestoreStock(orderId, userId);

    track("order_cancelled", { orderId, userId });

    return {
      error: null,
      update: {
        status: "cancelled",
        payment_status: "closed",
        updated_at: now,
      },
    };
  } catch (error: unknown) {
    captureError(error, {
      scope: "orderActions",
      message: "cancelOrderAction 失败",
      orderId,
      userId,
    });

    return {
      error: error instanceof Error ? error.message : "取消订单失败",
      update: null,
    };
  }
}

/** 确认收货动作封装：只暴露结果，不让 store 直接耦合 Supabase 写法。 */
export async function confirmReceiveAction(
  orderId: string,
  userId: string,
): Promise<OrderMutationResult> {
  const now = new Date().toISOString();

  try {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "delivered",
        delivered_at: now,
        updated_at: now,
      })
      .eq("id", orderId)
      .eq("user_id", userId);

    if (error) {
      return {
        error: error.message || "确认收货失败",
        update: null,
      };
    }

    track("order_confirmed", { orderId, userId });

    return {
      error: null,
      update: {
        status: "delivered",
        delivered_at: now,
        updated_at: now,
      },
    };
  } catch (error: unknown) {
    captureError(error, {
      scope: "orderActions",
      message: "confirmReceiveAction 失败",
      orderId,
      userId,
    });

    return {
      error: error instanceof Error ? error.message : "确认收货失败",
      update: null,
    };
  }
}
