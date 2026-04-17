import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import { logWarn } from "@/lib/logger";
import type { PushNavigationData } from "@/lib/pushTypes";
import { routes } from "@/lib/routes";
import { supabase } from "@/lib/supabase";
import {
  invokeSupabaseFunctionStrict,
  SupabaseFunctionError,
} from "@/lib/supabaseFunction";
import type { PushPreference } from "@/types/database";

// 对外保持原有公开 API：纯逻辑实现迁移到 @/lib/pushTypes，这里只做再导出。
export {
  extractPushNavigationData,
  resolvePushTypeFromNotification,
  type PushNavigationData,
  type PushType,
} from "@/lib/pushTypes";

const PUSH_TOKEN_STORAGE_KEY = "push:expo-token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface RegisterPushDeviceResult {
  deviceId: string;
  userId: string;
  platform: string;
  expoPushToken: string;
  isActive: boolean;
  lastSeenAt: string | null;
  preference: PushPreference;
}

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

export function isPushPlatformSupported() {
  return Platform.OS === "android";
}

export function isPhysicalDevice() {
  return Device.isDevice;
}

export async function createDefaultNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#B88947",
    sound: "default",
  });
}

export async function getNotificationPermissionStatus() {
  const permission = await Notifications.getPermissionsAsync();
  return permission.status;
}

export async function requestNotificationPermissionIfNeeded() {
  const currentStatus = await getNotificationPermissionStatus();
  if (currentStatus === "granted" || currentStatus === "denied") {
    return currentStatus;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status;
}

export async function getExpoPushToken() {
  if (!isPushPlatformSupported()) {
    throw new Error("当前平台暂不支持推送注册。");
  }

  if (!isPhysicalDevice()) {
    throw new Error("推送通知需要在真机环境下验证。");
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error("未找到 EAS projectId，无法获取 Expo push token。");
  }

  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!result.data?.trim()) {
    throw new Error("Expo push token 获取失败。");
  }

  return result.data.trim();
}

export async function persistPushToken(token: string) {
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

export async function readStoredPushToken() {
  return AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function clearStoredPushToken() {
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function loadPushPreference(userId: string) {
  const { data, error } = await supabase
    .from("push_preferences")
    .select("*")
    .eq("user_id", userId)
    .single<PushPreference>();

  if (error) {
    if ("code" in error && error.code === "PGRST116") {
      const defaultPreference = {
        user_id: userId,
        push_enabled: true,
        order_enabled: true,
        after_sale_enabled: true,
        community_enabled: true,
        quiet_hours_start: null,
        quiet_hours_end: null,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("push_preferences")
        .upsert(defaultPreference, { onConflict: "user_id" })
        .select("*")
        .single<PushPreference>();

      if (insertError || !inserted) {
        throw new Error(insertError?.message ?? "初始化推送偏好失败");
      }

      return inserted;
    }

    throw new Error(error.message || "加载推送偏好失败");
  }

  return data;
}

export async function updatePushPreference(
  userId: string,
  patch: Partial<
    Pick<
      PushPreference,
      "push_enabled" | "order_enabled" | "after_sale_enabled" | "community_enabled"
    >
  >,
) {
  const { data, error } = await supabase
    .from("push_preferences")
    .upsert(
      {
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single<PushPreference>();

  if (error || !data) {
    throw new Error(error?.message ?? "更新推送偏好失败");
  }

  return data;
}

export async function registerPushDevice(input: {
  expoPushToken: string;
  platform: "android" | "ios";
  deviceName?: string | null;
  appVersion?: string | null;
}) {
  const result = await invokeSupabaseFunctionStrict<RegisterPushDeviceResult>(
    "register-push-device",
    {
      authMode: "session",
      fallbackMessage: "注册推送设备失败。",
      invalidDataMessage: "服务端未返回有效的推送设备注册结果。",
      validate: (payload) =>
        Boolean(
          payload &&
            typeof payload.deviceId === "string" &&
            typeof payload.expoPushToken === "string" &&
            payload.preference &&
            typeof payload.preference.push_enabled === "boolean",
        ),
      body: input,
    },
  );

  await persistPushToken(result.expoPushToken);
  return result;
}

export async function unregisterPushDevice(params: {
  expoPushToken?: string | null;
  deviceId?: string | null;
}) {
  await invokeSupabaseFunctionStrict<{ success: boolean }>(
    "unregister-push-device",
    {
      authMode: "session",
      fallbackMessage: "停用推送设备失败。",
      invalidDataMessage: "服务端未返回有效的设备停用结果。",
      validate: (payload) => Boolean(payload && payload.success === true),
      body: {
        expoPushToken: params.expoPushToken ?? null,
        deviceId: params.deviceId ?? null,
      },
    },
  );

  if (params.expoPushToken) {
    await clearStoredPushToken();
  }
}

export async function unregisterStoredPushDevice() {
  const token = await readStoredPushToken();
  if (!token) {
    return;
  }

  try {
    await unregisterPushDevice({ expoPushToken: token });
  } catch (error) {
    if (error instanceof SupabaseFunctionError && error.kind === "auth") {
      return;
    }

    logWarn("pushNotifications", "unregisterStoredPushDevice 失败", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function navigateFromPushData(data: PushNavigationData) {
  if (data.relatedType === "order" && data.relatedId) {
    router.push(routes.tracking(data.relatedId));
    return;
  }

  if (data.relatedType === "after_sale_request" && data.relatedId) {
    router.push(routes.afterSaleDetail(data.relatedId));
    return;
  }

  if (data.relatedType === "post" && data.relatedId) {
    router.push(routes.post(data.relatedId));
    return;
  }

  router.push(routes.notifications);
}

export function addPushNotificationListeners(handlers: {
  onReceive?: (notification: Notifications.Notification) => void;
  onResponse?: (response: Notifications.NotificationResponse) => void;
}) {
  if (!isPushPlatformSupported()) {
    return () => undefined;
  }

  const receiveSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      handlers.onReceive?.(notification);
    },
  );

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      handlers.onResponse?.(response);
    });

  return () => {
    receiveSubscription.remove();
    responseSubscription.remove();
  };
}

export async function handleLastNotificationResponse(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  if (!isPushPlatformSupported()) {
    return;
  }

  const response = await Notifications.getLastNotificationResponseAsync();
  if (response) {
    handler(response);
  }
}
