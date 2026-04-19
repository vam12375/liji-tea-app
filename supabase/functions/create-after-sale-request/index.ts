// create-after-sale-request：接收用户"整单退款"申请，做订单归属 + 状态机校验后写入 after_sale_requests。
// 退款金额以订单已支付金额为准，不信任客户端传入的金额；命中自动退款条件时直接落到 auto_approved，否则进入 pending_review。
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  enforceRateLimit,
  rateLimitedResponse,
} from "../_shared/rateLimit.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

type AfterSaleInitialStatus = "auto_approved" | "pending_review";

interface CreateAfterSaleRequestBody {
  orderId?: string;
  reasonCode?: string;
  reasonText?: string | null;
}

interface OrderSummaryRow {
  id: string;
  order_no: string | null;
  user_id: string;
  status: "pending" | "paid" | "shipping" | "delivered" | "cancelled";
  total: number;
  payment_method: string | null;
  payment_channel: string | null;
  delivery_type: string;
  shipped_at: string | null;
  order_items:
    | {
        quantity: number;
        product: { name: string | null } | null;
      }[]
    | null;
  address:
    | {
        name: string | null;
        phone: string | null;
        address: string | null;
      }
    | null;
}

function resolveInitialStatus(order: OrderSummaryRow): AfterSaleInitialStatus | null {
  if (order.status === "paid" && !order.shipped_at) {
    return "auto_approved";
  }

  if (order.status === "shipping" || order.status === "delivered") {
    return "pending_review";
  }

  return null;
}

function getNotificationPayload(status: AfterSaleInitialStatus) {
  if (status === "auto_approved") {
    return {
      title: "退款申请已自动通过",
      message: "订单符合自动退款条件，系统已进入退款处理阶段。",
    };
  }

  return {
    title: "退款申请待审核",
    message: "退款申请已进入人工审核，请留意后续结果。",
  };
}

function buildSnapshot(order: OrderSummaryRow) {
  return {
    orderNo: order.order_no,
    total: Number(order.total ?? 0),
    paymentMethod: order.payment_method,
    paymentChannel: order.payment_channel,
    deliveryType: order.delivery_type,
    itemSummary: (order.order_items ?? []).map((item) => ({
      productName: item.product?.name ?? "商品",
      quantity: item.quantity,
    })),
    addressSummary: order.address
      ? {
          name: order.address.name,
          phone: order.address.phone,
          address: order.address.address,
        }
      : null,
  };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse(req, "仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return errorResponse(req, "未登录或登录状态已失效。", 401, "unauthorized");
    }

    // 限流：同一用户 10 分钟内最多 5 次发起售后；防止通过重复申请绕过风控。
    const rateLimit = await enforceRateLimit(user.id, {
      bucket: "create-after-sale",
      max: 5,
      windowSec: 600,
    });
    if (!rateLimit.allowed) {
      return rateLimitedResponse(req, rateLimit.retryAfterSec);
    }

    const body = (await req.json().catch(() => null)) as CreateAfterSaleRequestBody | null;
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const reasonCode =
      typeof body?.reasonCode === "string" ? body.reasonCode.trim() : "";
    const reasonText =
      typeof body?.reasonText === "string" ? body.reasonText.trim() : null;

    if (!orderId) {
      return errorResponse(req, "缺少 orderId。", 400, "missing_order_id");
    }

    if (!reasonCode) {
      return errorResponse(req, "请选择退款原因。", 400, "missing_reason_code");
    }

    const supabase = createServiceClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_no,
          user_id,
          status,
          total,
          payment_method,
          payment_channel,
          delivery_type,
          shipped_at,
          order_items(quantity, product:products(name)),
          address:addresses(name, phone, address)
        `,
      )
      .eq("id", orderId)
      .single<OrderSummaryRow>();

    if (orderError || !order) {
      return errorResponse(req, "订单不存在。", 404, "order_not_found");
    }

    if (order.user_id !== user.id) {
      return errorResponse(req, "无权发起该订单的退款申请。", 403, "forbidden");
    }

    const initialStatus = resolveInitialStatus(order);
    if (!initialStatus) {
      return errorResponse(req, 
        "当前订单状态不支持发起退款申请。",
        422,
        "order_status_not_supported",
      );
    }

    const { data: activeRequests, error: activeRequestError } = await supabase
      .from("after_sale_requests")
      .select("id")
      .eq("order_id", orderId)
      .in("status", [
        "submitted",
        "auto_approved",
        "pending_review",
        "approved",
        "refunding",
      ])
      .limit(1);

    if (activeRequestError) {
      return errorResponse(req, 
        "校验售后申请状态失败。",
        500,
        "after_sale_check_failed",
        activeRequestError.message,
      );
    }

    if (Array.isArray(activeRequests) && activeRequests.length > 0) {
      return errorResponse(req, 
        "该订单已有进行中的售后申请。",
        422,
        "duplicate_after_sale_request",
      );
    }

    const requestedAmount = Number(order.total ?? 0);
    const { data: request, error: requestError } = await supabase
      .from("after_sale_requests")
      .insert({
        order_id: order.id,
        user_id: user.id,
        request_type: "refund",
        scope_type: "order",
        status: initialStatus,
        reason_code: reasonCode,
        reason_text: reasonText,
        requested_amount: requestedAmount,
        approved_amount:
          initialStatus === "auto_approved" ? requestedAmount : null,
        snapshot: buildSnapshot(order),
      })
      .select("id, order_id, status, requested_amount, approved_amount")
      .single<{
        id: string;
        order_id: string;
        status: AfterSaleInitialStatus;
        requested_amount: number;
        approved_amount: number | null;
      }>();

    if (requestError || !request) {
      const code =
        requestError?.message?.includes("uq_after_sale_requests_active_order")
          ? "duplicate_after_sale_request"
          : "create_after_sale_request_failed";
      const message =
        code === "duplicate_after_sale_request"
          ? "该订单已有进行中的售后申请。"
          : "创建退款申请失败。";

      return errorResponse(req, message, 422, code, requestError?.message);
    }

    const notification = getNotificationPayload(initialStatus);
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "order",
      title: notification.title,
      message: notification.message,
      related_type: "after_sale_request",
      related_id: request.id,
      metadata: {
        after_sale_request_id: request.id,
        order_id: request.order_id,
        after_sale_status: request.status,
        refund_amount:
          request.approved_amount ?? request.requested_amount,
      },
    });

    return jsonResponse(req, {
      requestId: request.id,
      orderId: request.order_id,
      status: request.status,
      requestedAmount: Number(request.requested_amount),
      approvedAmount:
        request.approved_amount === null
          ? null
          : Number(request.approved_amount),
    });
  } catch (error) {
    return errorResponse(req, 
      error instanceof Error ? error.message : "创建退款申请失败。",
      500,
      "internal_error",
    );
  }
});
