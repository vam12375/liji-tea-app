import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import { createServiceClient, getUserFromRequest } from "../_shared/supabase.ts";

interface OrderStatusRow {
  id: string;
  user_id: string;
  status: string;
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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse("仅支持 GET 或 POST 请求。", 405, "method_not_allowed");
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return errorResponse("未登录或登录状态已失效。", 401, "unauthorized");
    }

    let orderId = req.url ? new URL(req.url).searchParams.get("orderId") ?? "" : "";

    if (!orderId && req.method === "POST") {
      const requestBody = await req.json().catch(() => null);
      orderId =
        requestBody && typeof requestBody.orderId === "string"
          ? requestBody.orderId
          : "";
    }

    if (!orderId) {
      return errorResponse("缺少 orderId。", 400, "missing_order_id");
    }

    const supabase = createServiceClient();
    // 客户端只查询自己的订单，避免越权读取支付状态。
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, user_id, status, total, payment_status, out_trade_no, trade_no, paid_at, paid_amount, payment_error_code, payment_error_message"
      )
      .eq("id", orderId)
      .single<OrderStatusRow>();

    if (error || !order) {
      return errorResponse("订单不存在。", 404, "order_not_found", error?.message);
    }

    if (order.user_id !== user.id) {
      return errorResponse("无权访问该订单。", 403, "forbidden");
    }

    // 返回的是服务端确认口径，客户端据此展示最终支付结果。
    return jsonResponse({
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      outTradeNo: order.out_trade_no,
      tradeNo: order.trade_no,
      paidAt: order.paid_at,
      paidAmount: order.paid_amount === null ? null : toNumber(order.paid_amount),
      paymentErrorCode: order.payment_error_code,
      paymentErrorMessage: order.payment_error_message,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "查询订单支付状态失败。",
      500,
      "internal_error"
    );
  }
});
