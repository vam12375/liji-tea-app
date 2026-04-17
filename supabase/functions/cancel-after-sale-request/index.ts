// cancel-after-sale-request：用户主动撤销仍在处理中的售后申请。
// 通过 service role 执行，避免客户端直接 UPDATE 绕过状态机（RLS 侧也未开放写入策略）。
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

interface CancelAfterSaleRequestBody {
  requestId?: string;
}

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

    const body = (await req.json().catch(() => null)) as CancelAfterSaleRequestBody | null;
    const requestId =
      typeof body?.requestId === "string" ? body.requestId.trim() : "";

    if (!requestId) {
      return errorResponse("缺少 requestId。", 400, "missing_request_id");
    }

    const supabase = createServiceClient();
    const { data: request, error: requestError } = await supabase
      .from("after_sale_requests")
      .select("id, order_id, user_id, status")
      .eq("id", requestId)
      .single<{
        id: string;
        order_id: string;
        user_id: string;
        status: string;
      }>();

    if (requestError || !request) {
      return errorResponse(
        "售后申请不存在。",
        404,
        "after_sale_request_not_found",
      );
    }

    if (request.user_id !== user.id) {
      return errorResponse("无权操作该售后申请。", 403, "forbidden");
    }

    if (
      request.status !== "submitted" &&
      request.status !== "pending_review"
    ) {
      return errorResponse(
        "当前状态不允许撤销申请。",
        422,
        "after_sale_status_not_cancellable",
      );
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from("after_sale_requests")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .select("id, order_id, status")
      .single<{
        id: string;
        order_id: string;
        status: "cancelled";
      }>();

    if (updateError || !updatedRequest) {
      return errorResponse(
        "撤销售后申请失败。",
        500,
        "cancel_after_sale_request_failed",
        updateError?.message,
      );
    }

    return jsonResponse({
      requestId: updatedRequest.id,
      orderId: updatedRequest.order_id,
      status: updatedRequest.status,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "撤销售后申请失败。",
      500,
      "internal_error",
    );
  }
});
