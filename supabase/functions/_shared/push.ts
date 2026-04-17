// 推送派发的服务端共享逻辑：封装偏好读取、分类过滤、Expo Push API 调用与投递日志落盘。
// 注意：所有操作都以 service role 身份执行，绕过 RLS；调用方需自行保证已完成鉴权。
import { createServiceClient } from "./supabase.ts";

export interface PushPreferenceRow {
  user_id: string;
  push_enabled: boolean;
  order_enabled: boolean;
  after_sale_enabled: boolean;
  community_enabled: boolean;
}

export interface PushDeviceRow {
  id: string;
  user_id: string;
  platform: "android" | "ios";
  expo_push_token: string;
  device_name: string | null;
  app_version: string | null;
  is_active: boolean;
}

export interface PushQueueRow {
  id: string;
  notification_id: string;
  user_id: string;
  push_type: "order" | "after_sale" | "community";
  payload: Record<string, unknown> | null;
  status: "pending" | "processing" | "sent" | "failed" | "skipped";
  attempt_count: number;
}

function getExpoPushSendUrl() {
  return "https://exp.host/--/api/v2/push/send";
}

export async function getOrCreatePushPreference(userId: string) {
  const supabase = createServiceClient();

  const { data: existing, error: readError } = await supabase
    .from("push_preferences")
    .select("*")
    .eq("user_id", userId)
    .single<PushPreferenceRow>();

  if (!readError && existing) {
    return existing;
  }

  const { data, error } = await supabase
    .from("push_preferences")
    .upsert(
      {
        user_id: userId,
        push_enabled: true,
        order_enabled: true,
        after_sale_enabled: true,
        community_enabled: true,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single<PushPreferenceRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "创建推送偏好失败");
  }

  return data;
}

export function isPushTypeEnabled(
  preference: PushPreferenceRow,
  pushType: PushQueueRow["push_type"],
) {
  if (!preference.push_enabled) {
    return false;
  }

  if (pushType === "order") {
    return preference.order_enabled;
  }

  if (pushType === "after_sale") {
    return preference.after_sale_enabled;
  }

  if (pushType === "community") {
    return preference.community_enabled;
  }

  return false;
}

export async function sendExpoPushMessages(
  messages: Array<Record<string, unknown>>,
) {
  const response = await fetch(getExpoPushSendUrl(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.errors?.[0]?.message === "string"
        ? data.errors[0].message
        : "调用 Expo Push Service 失败",
    );
  }

  return data as {
    data?: Array<{
      status?: "ok" | "error";
      id?: string;
      message?: string;
      details?: { error?: string };
    }>;
  };
}
