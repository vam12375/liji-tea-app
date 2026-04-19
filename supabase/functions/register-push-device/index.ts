// register-push-device：幂等地写入用户当前设备的 Expo push token。
// 为什么不让客户端直接 upsert：需要统一校验平台合法性 + 归一化 last_seen_at + 联动 push_preferences 默认值。
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import { getOrCreatePushPreference } from "../_shared/push.ts";
import {
  enforceRateLimit,
  rateLimitedResponse,
} from "../_shared/rateLimit.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

interface RegisterPushDeviceBody {
  expoPushToken?: string;
  platform?: string;
  deviceName?: string | null;
  appVersion?: string | null;
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

    // 限流：60 秒内最多 5 次注册；正常冷启动仅需 1-2 次，高频注册大概率是脚本。
    const rateLimit = await enforceRateLimit(user.id, {
      bucket: "register-push-device",
      max: 5,
      windowSec: 60,
    });
    if (!rateLimit.allowed) {
      return rateLimitedResponse(req, rateLimit.retryAfterSec);
    }

    const body = (await req.json().catch(() => null)) as RegisterPushDeviceBody | null;
    const expoPushToken =
      typeof body?.expoPushToken === "string" ? body.expoPushToken.trim() : "";
    const platform =
      body?.platform === "android" || body?.platform === "ios"
        ? body.platform
        : null;

    if (!expoPushToken) {
      return errorResponse(req, "缺少 Expo push token。", 400, "missing_expo_push_token");
    }

    if (!platform) {
      return errorResponse(req, "缺少有效的平台信息。", 400, "invalid_platform");
    }

    const supabase = createServiceClient();
    const { data: device, error: deviceError } = await supabase
      .from("push_devices")
      .upsert(
        {
          user_id: user.id,
          platform,
          expo_push_token: expoPushToken,
          device_name:
            typeof body?.deviceName === "string" ? body.deviceName.trim() : null,
          app_version:
            typeof body?.appVersion === "string" ? body.appVersion.trim() : null,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "expo_push_token" },
      )
      .select("id, user_id, platform, expo_push_token, is_active, last_seen_at")
      .single<{
        id: string;
        user_id: string;
        platform: string;
        expo_push_token: string;
        is_active: boolean;
        last_seen_at: string | null;
      }>();

    if (deviceError || !device) {
      return errorResponse(req, 
        "注册推送设备失败。",
        500,
        "register_push_device_failed",
        deviceError?.message,
      );
    }

    const preference = await getOrCreatePushPreference(user.id);

    return jsonResponse(req, {
      deviceId: device.id,
      userId: device.user_id,
      platform: device.platform,
      expoPushToken: device.expo_push_token,
      isActive: device.is_active,
      lastSeenAt: device.last_seen_at,
      preference,
    });
  } catch (error) {
    return errorResponse(req, 
      error instanceof Error ? error.message : "注册推送设备失败。",
      500,
      "internal_error",
    );
  }
});
