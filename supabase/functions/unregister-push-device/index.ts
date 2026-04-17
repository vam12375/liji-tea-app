// unregister-push-device：将当前设备从推送名单中下线（软下线，保留历史记录）。
// 登出、关闭推送总开关、换号等场景均会调用；避免客户端直接删除导致投递队列 FK 失效。
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

interface UnregisterPushDeviceBody {
  expoPushToken?: string;
  deviceId?: string;
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

    const body = (await req.json().catch(() => null)) as UnregisterPushDeviceBody | null;
    const expoPushToken =
      typeof body?.expoPushToken === "string" ? body.expoPushToken.trim() : "";
    const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";

    if (!expoPushToken && !deviceId) {
      return errorResponse(
        "缺少设备标识。",
        400,
        "missing_push_device_identifier",
      );
    }

    const supabase = createServiceClient();
    let query = supabase
      .from("push_devices")
      .update({
        is_active: false,
        last_seen_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (expoPushToken) {
      query = query.eq("expo_push_token", expoPushToken);
    }

    if (deviceId) {
      query = query.eq("id", deviceId);
    }

    const { error } = await query;
    if (error) {
      return errorResponse(
        "停用推送设备失败。",
        500,
        "unregister_push_device_failed",
        error.message,
      );
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "停用推送设备失败。",
      500,
      "internal_error",
    );
  }
});
