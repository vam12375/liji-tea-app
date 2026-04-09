import { track } from "@/lib/analytics";
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

/**仅在客户端视图层映射超时订单状态，不直接回写服务端。 */
export async function applyExpiredPendingOrderState(order: Order): Promise<Order> {
  if (!isPendingOrderExpired(order)) {
    return order;
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
