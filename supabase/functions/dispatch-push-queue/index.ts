// dispatch-push-queue：调度器定时触发的推送派发器，消费 push_dispatch_queue 并调用 Expo Push API。
// 需要 PUSH_DISPATCH_SECRET 鉴权；只有 service role 才能看到队列，客户端不可直接调用。
declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  getOrCreatePushPreference,
  isPushTypeEnabled,
  sendExpoPushMessages,
  type PushDeviceRow,
  type PushPreferenceRow,
  type PushQueueRow,
} from "../_shared/push.ts";
import { createServiceClient } from "../_shared/supabase.ts";

interface DispatchPushQueueBody {
  limit?: number;
}

function getDispatchSecret() {
  return Deno.env.get("PUSH_DISPATCH_SECRET")?.trim() || "";
}

function isAuthorized(req: Request) {
  const secret = getDispatchSecret();
  if (!secret) {
    return false;
  }

  return req.headers.get("x-push-dispatch-secret")?.trim() === secret;
}

function getString(record: Record<string, unknown>, key: string, fallback = "") {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

async function markQueueState(params: {
  queueId: string;
  status: PushQueueRow["status"];
  attemptCount?: number;
  lastError?: string | null;
}) {
  const supabase = createServiceClient();
  await supabase
    .from("push_dispatch_queue")
    .update({
      status: params.status,
      attempt_count: params.attemptCount,
      last_error: params.lastError ?? null,
      processed_at:
        params.status === "processing" ? null : new Date().toISOString(),
    })
    .eq("id", params.queueId);
}

async function insertDeliveryLog(params: {
  queueId: string;
  deviceId: string;
  expoPushToken: string;
  status: "ok" | "error" | "skipped";
  ticketId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const supabase = createServiceClient();
  await supabase.from("push_delivery_logs").insert({
    queue_id: params.queueId,
    device_id: params.deviceId,
    expo_push_token: params.expoPushToken,
    ticket_id: params.ticketId ?? null,
    status: params.status,
    error_code: params.errorCode ?? null,
    error_message: params.errorMessage ?? null,
  });
}

async function processQueueItem(
  queue: PushQueueRow,
  preference: PushPreferenceRow,
  devices: PushDeviceRow[],
) {
  if (!isPushTypeEnabled(preference, queue.push_type)) {
    await markQueueState({
      queueId: queue.id,
      status: "skipped",
      attemptCount: queue.attempt_count + 1,
      lastError: "push_disabled_by_preference",
    });
    return { status: "skipped" as const };
  }

  const activeDevices = devices.filter((device) => device.is_active);
  if (activeDevices.length === 0) {
    await markQueueState({
      queueId: queue.id,
      status: "skipped",
      attemptCount: queue.attempt_count + 1,
      lastError: "no_active_push_device",
    });
    return { status: "skipped" as const };
  }

  await markQueueState({
    queueId: queue.id,
    status: "processing",
    attemptCount: queue.attempt_count + 1,
  });

  const payload = queue.payload ?? {};
  const messages = activeDevices.map((device) => ({
    to: device.expo_push_token,
    title: getString(payload, "title"),
    body: getString(payload, "body"),
    data: {
      notificationId: payload.notificationId ?? null,
      relatedType: payload.relatedType ?? null,
      relatedId: payload.relatedId ?? null,
      type: payload.type ?? null,
    },
    channelId: "default",
    sound: "default",
  }));

  try {
    const result = await sendExpoPushMessages(messages);
    const responses = Array.isArray(result.data) ? result.data : [];

    let hasSuccess = false;
    for (const [index, response] of responses.entries()) {
      const device = activeDevices[index];
      if (!device) {
        continue;
      }

      if (response.status === "ok") {
        hasSuccess = true;
        await insertDeliveryLog({
          queueId: queue.id,
          deviceId: device.id,
          expoPushToken: device.expo_push_token,
          status: "ok",
          ticketId: response.id ?? null,
        });
        continue;
      }

      const errorCode = response.details?.error ?? null;
      const errorMessage = response.message ?? "推送发送失败";

      await insertDeliveryLog({
        queueId: queue.id,
        deviceId: device.id,
        expoPushToken: device.expo_push_token,
        status: "error",
        errorCode,
        errorMessage,
      });

      if (errorCode === "DeviceNotRegistered") {
        const supabase = createServiceClient();
        await supabase
          .from("push_devices")
          .update({ is_active: false })
          .eq("id", device.id);
      }
    }

    await markQueueState({
      queueId: queue.id,
      status: hasSuccess ? "sent" : "failed",
      attemptCount: queue.attempt_count + 1,
      lastError: hasSuccess ? null : "expo_push_send_failed",
    });

    return { status: hasSuccess ? "sent" as const : "failed" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "调用 Expo Push Service 失败";

    for (const device of activeDevices) {
      await insertDeliveryLog({
        queueId: queue.id,
        deviceId: device.id,
        expoPushToken: device.expo_push_token,
        status: "error",
        errorMessage: message,
      });
    }

    await markQueueState({
      queueId: queue.id,
      status: "failed",
      attemptCount: queue.attempt_count + 1,
      lastError: message,
    });

    return { status: "failed" as const, error: message };
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse("仅支持 POST 请求。", 405, "method_not_allowed");
  }

  if (!isAuthorized(req)) {
    return errorResponse("无权调用推送分发任务。", 401, "unauthorized");
  }

  try {
    const body = (await req.json().catch(() => null)) as DispatchPushQueueBody | null;
    const limit =
      typeof body?.limit === "number" && body.limit > 0
        ? Math.min(body.limit, 100)
        : 20;

    const supabase = createServiceClient();
    const { data: queueItems, error: queueError } = await supabase
      .from("push_dispatch_queue")
      .select("id, notification_id, user_id, push_type, payload, status, attempt_count")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(limit);

    if (queueError) {
      return errorResponse(
        "读取推送队列失败。",
        500,
        "push_queue_read_failed",
        queueError.message,
      );
    }

    const items = (queueItems ?? []) as PushQueueRow[];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const queue of items) {
      const preference = await getOrCreatePushPreference(queue.user_id);
      const { data: devices, error: deviceError } = await supabase
        .from("push_devices")
        .select("id, user_id, platform, expo_push_token, device_name, app_version, is_active")
        .eq("user_id", queue.user_id)
        .eq("is_active", true);

      if (deviceError) {
        await markQueueState({
          queueId: queue.id,
          status: "failed",
          attemptCount: queue.attempt_count + 1,
          lastError: deviceError.message,
        });
        failedCount += 1;
        continue;
      }

      const result = await processQueueItem(
        queue,
        preference,
        (devices ?? []) as PushDeviceRow[],
      );

      if (result.status === "sent") {
        sentCount += 1;
      } else if (result.status === "skipped") {
        skippedCount += 1;
      } else {
        failedCount += 1;
      }
    }

    return jsonResponse({
      processed: items.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "推送分发失败。",
      500,
      "internal_error",
    );
  }
});
