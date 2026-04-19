declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  enforceRateLimit,
  rateLimitedResponse,
} from "../_shared/rateLimit.ts";
import { getUserFromRequest, createServiceClient } from "../_shared/supabase.ts";

interface CancelOrderRpcRow {
  released: boolean;
  order_status: string;
  payment_status: string;
}

function isCancelOrderRpcRow(value: unknown): value is CancelOrderRpcRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "released" in value &&
    "order_status" in value &&
    "payment_status" in value
  );
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
    const authHeader = req.headers.get("Authorization");
    console.log("[cancel-order] auth diagnostics", {
      hasAuthorizationHeader: Boolean(authHeader),
      authorizationPrefix: authHeader ? authHeader.slice(0, 16) : null,
    });

    const user = await getUserFromRequest(req);

    console.log("[cancel-order] user diagnostics", {
 hasUser: Boolean(user),
      userId: user?.id ?? null,
    });

    if (!user) {
      return errorResponse(req, "未登录或登录状态已失效。", 401, "unauthorized");
    }

    // 限流：同一用户 60 秒内最多 10 次取消；防止脚本连点 / 手抖重复触发状态翻动。
    const rateLimit = await enforceRateLimit(user.id, {
      bucket: "cancel-order",
      max: 10,
      windowSec: 60,
    });
    if (!rateLimit.allowed) {
      return rateLimitedResponse(req, rateLimit.retryAfterSec);
    }

    const requestBody = await req.json().catch(() => null);
    const orderId =
      requestBody && typeof requestBody.orderId === "string"
        ? requestBody.orderId.trim()
        : "";

    if (!orderId) {
 return errorResponse(req, "缺少 orderId。", 400, "missing_order_id");
    }

    const supabase = createServiceClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, status, payment_status")
      .eq("id", orderId)
      .single<{
        id: string;
        user_id: string;
        status: string;
 payment_status: string | null;
      }>();

    if (orderError || !order) {
      return errorResponse(req, 
        "订单不存在。",
        404,
        "order_not_found",
        orderError?.message,
      );
    }

    if (order.user_id !== user.id) {
      return errorResponse(req, "无权操作该订单。", 403, "forbidden");
    }

    const { data, error } = await supabase.rpc(
      "cancel_pending_order_and_restore_stock",
      {
        p_order_id: orderId,
        p_user_id: user.id,
        p_payment_status: "closed",
        p_payment_error_code: "user_cancelled",
        p_payment_error_message: "订单已取消。",
      },
    );

    if (error) {
 return errorResponse(req, 
        "取消订单失败。",
        500,
        "cancel_order_failed",
        error.message,
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!isCancelOrderRpcRow(result)) {
      return errorResponse(req, 
        "服务端未返回有效的取消订单结果。",
        500,
        "invalid_cancel_order_result",
      );
    }

    return jsonResponse(req, {
      orderId,
      released: result.released,
      status: result.order_status,
      paymentStatus: result.payment_status,
    });
  } catch (error) {
 return errorResponse(req, 
      error instanceof Error ? error.message : "取消订单失败。",
      500,
      "internal_error",
    );
  }
});
