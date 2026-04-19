import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  closeExpiredPendingOrder,
  isPendingOrderExpired,
} from "../_shared/payment.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

interface OrderStatusRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  total: number | string | null;
  payment_status: string | null;
  out_trade_no: string | null;
  trade_no: string | null;
  paid_at: string | null;
  paid_amount: number | string | null;
  payment_error_code: string | null;
  payment_error_message: string | null;
}

/** 兼容数据库 numeric / text 返回值。 */
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse(req, 
      "仅支持 GET 或 POST 请求。",
      405,
      "method_not_allowed",
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    console.log("[payment-order-status] auth diagnostics", {
      hasAuthorizationHeader: Boolean(authHeader),
      authorizationPrefix: authHeader ? authHeader.slice(0, 16) : null,
    });

    const user = await getUserFromRequest(req);

    console.log("[payment-order-status] user diagnostics", {
      hasUser: Boolean(user),
      userId: user?.id ?? null,
    });

    if (!user) {
      return errorResponse(req, "未登录或登录状态已失效。", 401, "unauthorized");
    }

    let orderId = req.url
      ? (new URL(req.url).searchParams.get("orderId") ?? "")
      : "";

    if (!orderId && req.method === "POST") {
      const requestBody = await req.json().catch(() => null);
      orderId =
        requestBody && typeof requestBody.orderId === "string"
          ? requestBody.orderId
          : "";
    }

    if (!orderId) {
      return errorResponse(req, "缺少 orderId。", 400, "missing_order_id");
    }

    const supabase = createServiceClient();
    // 客户端只查询自己的订单，避免越权读取支付状态。
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, user_id, status, created_at, total, payment_status, payment_channel, out_trade_no, trade_no, paid_at, paid_amount, payment_error_code, payment_error_message",
      )
      .eq("id", orderId)
      .single<OrderStatusRow & { payment_channel?: string | null }>();

    if (error || !order) {
      return errorResponse(req, 
        "订单不存在。",
        404,
        "order_not_found",
        error?.message,
      );
    }

    if (order.user_id !== user.id) {
      return errorResponse(req, "无权访问该订单。", 403, "forbidden");
    }

    let currentOrder = order;

    if (isPendingOrderExpired(currentOrder)) {
      try {
        const canAttemptRemoteClose =
          !currentOrder.out_trade_no || currentOrder.payment_channel === "alipay";

        if (!canAttemptRemoteClose) {
          currentOrder = {
            ...currentOrder,
            status: "cancelled",
            payment_status: "closed",
            payment_error_code: "order_expired",
            payment_error_message: "待付款订单已超过 5 分钟，系统已自动取消。",
          };
        } else {
          const expiredResult = await closeExpiredPendingOrder(currentOrder);
          if (expiredResult.error) {
 console.error("[payment-order-status] closeExpiredPendingOrder failed", {
              orderId: currentOrder.id,
              paymentChannel: currentOrder.payment_channel ?? null,
              hasOutTradeNo: Boolean(currentOrder.out_trade_no),
              errorMessage: expiredResult.error.message,
            });

            currentOrder = {
              ...currentOrder,
              status: "cancelled",
 payment_status: "closed",
              payment_error_code: "order_expired",
              payment_error_message: "待付款订单已超过 5 分钟，系统已自动取消。",
            };
          } else if (expiredResult.expired) {
            currentOrder = {
              ...currentOrder,
              status: "cancelled",
 payment_status: "closed",
              payment_error_code: "order_expired",
              payment_error_message: "待付款订单已超过 5 分钟，系统已自动取消。",
            };
          }
        }
      } catch (expireSyncError) {
        console.error("[payment-order-status] expired order sync threw", {
 orderId: currentOrder.id,
          paymentChannel: currentOrder.payment_channel ?? null,
          hasOutTradeNo: Boolean(currentOrder.out_trade_no),
          error:
            expireSyncError instanceof Error
              ? expireSyncError.message
              : String(expireSyncError),
        });

        currentOrder = {
          ...currentOrder,
          status: "cancelled",
          payment_status: "closed",
          payment_error_code: "order_expired",
          payment_error_message: "待付款订单已超过 5 分钟，系统已自动取消。",
        };
      }
    }

    // 返回的是服务端确认口径，客户端据此展示最终支付结果。
    return jsonResponse(req, {
      orderId: currentOrder.id,
      status: currentOrder.status,
      paymentStatus: currentOrder.payment_status,
      outTradeNo: currentOrder.out_trade_no,
      tradeNo: currentOrder.trade_no,
      paidAt: currentOrder.paid_at,
      paidAmount:
        currentOrder.paid_amount === null
          ? null
          : toNumber(currentOrder.paid_amount),
      paymentErrorCode: currentOrder.payment_error_code,
      paymentErrorMessage: currentOrder.payment_error_message,
    });
  } catch (error) {
    return errorResponse(req, 
      error instanceof Error ? error.message : "查询订单支付状态失败。",
      500,
      "internal_error",
    );
  }
});
