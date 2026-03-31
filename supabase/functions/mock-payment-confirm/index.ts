declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
    closeExpiredPendingOrder,
    fetchPaymentOrderById,
    markOrderPaid,
    type PaymentOrderRow,
} from "../_shared/payment.ts";
import { getUserFromRequest } from "../_shared/supabase.ts";

const MOCK_CHANNELS = new Set(["wechat", "card"]);

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse("仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return errorResponse("未登录或登录状态已失效。", 401, "unauthorized");
    }

    const requestBody = await req.json().catch(() => null);
    const orderId =
      requestBody && typeof requestBody.orderId === "string"
        ? requestBody.orderId
        : "";

    if (!orderId) {
      return errorResponse("缺少 orderId。", 400, "missing_order_id");
    }

    const { data: order, error } = await fetchPaymentOrderById(orderId);

    if (error || !order) {
      return errorResponse(
        "订单不存在。",
        404,
        "order_not_found",
        error?.message,
      );
    }

    if (order.user_id !== user.id) {
      return errorResponse("无权访问该订单。", 403, "forbidden");
    }

    const channel = order.payment_channel || order.payment_method || "";

    if (!MOCK_CHANNELS.has(channel)) {
      return errorResponse(
        "当前订单不支持模拟支付。",
        422,
        "channel_not_supported",
      );
    }

    if (order.status === "pending") {
      const expiredResult = await closeExpiredPendingOrder(order);
      if (expiredResult.error) {
        return errorResponse(
          "检查待付款订单是否超时失败。",
          500,
          "pending_order_expire_check_failed",
          expiredResult.error.message,
        );
      }

      if (expiredResult.expired) {
        return errorResponse(
          "待付款订单已超过 10 分钟，系统已自动取消。",
          409,
          "order_expired",
        );
      }
    }

    if (order.status !== "pending") {
      if (order.status === "paid" && order.payment_status === "success") {
        return jsonResponse({
          orderId: order.id,
          status: order.status,
          paymentStatus: order.payment_status,
          paymentChannel: channel,
          paidAt: order.paid_at,
          paidAmount: order.paid_amount,
        });
      }

      return errorResponse(
        "当前订单状态不允许再次发起模拟支付。",
        409,
        "invalid_order_status",
      );
    }

    const paidAt = new Date().toISOString();
    const outTradeNo =
      order.out_trade_no ||
      `MOCK${Date.now()}${order.id
        .replace(/[^0-9A-Za-z]/g, "")
        .slice(-8)
        .toUpperCase()}`;
    const tradeNo = `${channel.toUpperCase()}_${Date.now()}`;

    const {
      error: paidError,
      paidAmount,
      logisticsCompany,
      logisticsTrackingNo,
    } = await markOrderPaid({
      order: order as PaymentOrderRow,
      channel,
      paymentStatus: "success",
      outTradeNo,
      tradeNo,
      paidAt,
      requestPayload: {
        source: "mock-payment-confirm",
        orderId: order.id,
        channel,
      },
      notifyPayload: {
        type: "mock_payment",
        channel,
        confirmed_at: paidAt,
      },
      notifyVerified: true,
    });

    if (paidError) {
      return errorResponse(
        "模拟支付成功落库失败。",
        500,
        "mock_payment_failed",
        paidError.message,
      );
    }

    return jsonResponse({
      orderId: order.id,
      status: "paid",
      paymentStatus: "success",
      paymentChannel: channel,
      paidAt,
      paidAmount,
      outTradeNo,
      tradeNo,
      logisticsCompany,
      logisticsTrackingNo,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "模拟支付失败。",
      500,
      "internal_error",
    );
  }
});
