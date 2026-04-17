// 推送会话容器：聚合平台能力、权限、token 与偏好设置，统一对外暴露一次 bootstrap。
// 本 store 只描述"当前设备"，真正的投递记录由服务端 push_delivery_logs 承载。
import Constants from "expo-constants";
import { Platform } from "react-native";
import { create } from "zustand";

import {
  createDefaultNotificationChannel,
  getExpoPushToken,
  getNotificationPermissionStatus,
  isPhysicalDevice,
  isPushPlatformSupported,
  loadPushPreference,
  requestNotificationPermissionIfNeeded,
  registerPushDevice,
  unregisterStoredPushDevice,
  updatePushPreference,
} from "@/lib/pushNotifications";
import { logWarn } from "@/lib/logger";
import type { PushPreference } from "@/types/database";

type PermissionState =
  | "undetermined"
  | "denied"
  | "granted"
  // unavailable 专指平台不支持推送（如当前 iOS 未接入），区别于用户主动拒绝。
  | "unavailable";

interface PushState {
  supported: boolean;
  isDevice: boolean;
  permissionStatus: PermissionState;
  expoPushToken: string | null;
  preference: PushPreference | null;
  bootstrapping: boolean;
  updatingPreference: boolean;
  error: string | null;
  bootstrap: (userId: string) => Promise<void>;
  refreshPreference: (userId: string) => Promise<void>;
  updatePreference: (
    userId: string,
    patch: Partial<
      Pick<
        PushPreference,
        "push_enabled" | "order_enabled" | "after_sale_enabled" | "community_enabled"
      >
    >,
  ) => Promise<void>;
  reset: () => void;
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// 兼容 Constants.deviceName 在模拟器缺失的场景，回退到"平台-应用版本"便于服务端聚合看。
function getDeviceName() {
  return (
    Constants.deviceName ??
    `${Platform.OS}-${Constants.expoConfig?.version ?? "unknown"}`
  );
}

export const usePushStore = create<PushState>()((set, get) => ({
  supported: isPushPlatformSupported(),
  isDevice: isPhysicalDevice(),
  permissionStatus: isPushPlatformSupported() ? "undetermined" : "unavailable",
  expoPushToken: null,
  preference: null,
  bootstrapping: false,
  updatingPreference: false,
  error: null,

  bootstrap: async (userId) => {
    if (!userId) {
      return;
    }

    try {
      set({
        bootstrapping: true,
        error: null,
        // Android / 真机判断每次 bootstrap 都重取一次，避免切设备后缓存误判。
        supported: isPushPlatformSupported(),
        isDevice: isPhysicalDevice(),
      });

      const preference = await loadPushPreference(userId);
      const permissionStatus = isPushPlatformSupported()
        ? await getNotificationPermissionStatus()
        : "unavailable";

      set({
        preference,
        permissionStatus,
      });

      if (!isPushPlatformSupported() || !isPhysicalDevice()) {
        // 不支持推送或非真机（模拟器）时直接结束引导，避免调用 Notifications API 报错。
        set({ bootstrapping: false });
        return;
      }

      await createDefaultNotificationChannel();

      if (!preference.push_enabled) {
        // 用户在偏好里关了总开关，就不再申请权限也不注册 token，保持静默。
        set({ bootstrapping: false });
        return;
      }

      const resolvedPermissionStatus =
        permissionStatus === "undetermined"
          ? await requestNotificationPermissionIfNeeded()
          : permissionStatus;

      if (resolvedPermissionStatus !== "granted") {
        set({
          bootstrapping: false,
          permissionStatus: resolvedPermissionStatus,
        });
        return;
      }

      const expoPushToken = await getExpoPushToken();
      // register-push-device Edge Function 会做幂等 upsert，并以 push_devices 唯一索引收敛 token。
      const registered = await registerPushDevice({
        expoPushToken,
        platform: "android",
        deviceName: getDeviceName(),
        appVersion: Constants.expoConfig?.version ?? null,
      });

      set({
        expoPushToken: registered.expoPushToken,
        preference: registered.preference,
        permissionStatus: resolvedPermissionStatus,
        bootstrapping: false,
      });
    } catch (error) {
      const message = normalizeErrorMessage(error, "初始化推送失败");
      logWarn("pushStore", "bootstrap 失败", { error: message, userId });
      set({ bootstrapping: false, error: message });
    }
  },

  refreshPreference: async (userId) => {
    try {
      const preference = await loadPushPreference(userId);
      set({ preference, error: null });
    } catch (error) {
      const message = normalizeErrorMessage(error, "加载推送偏好失败");
      logWarn("pushStore", "refreshPreference 失败", {
        error: message,
        userId,
      });
      set({ error: message });
    }
  },

  updatePreference: async (userId, patch) => {
    try {
      set({ updatingPreference: true, error: null });
      const preference = await updatePushPreference(userId, patch);

      set({ preference });

      if (!preference.push_enabled) {
        // 总开关关闭：本地同步注销设备并清空 token，避免遗留推送记录。
        await unregisterStoredPushDevice();
        set({
          expoPushToken: null,
          updatingPreference: false,
          permissionStatus: await getNotificationPermissionStatus().catch(
            () => get().permissionStatus,
          ),
        });
        return;
      }

      if (!isPushPlatformSupported() || !isPhysicalDevice()) {
        set({ updatingPreference: false });
        return;
      }

      await createDefaultNotificationChannel();
      const currentPermissionStatus = await getNotificationPermissionStatus();
      const permissionStatus =
        currentPermissionStatus === "undetermined"
          ? await requestNotificationPermissionIfNeeded()
          : currentPermissionStatus;

      if (permissionStatus !== "granted") {
        set({ updatingPreference: false, permissionStatus });
        return;
      }

      const expoPushToken = await getExpoPushToken();
      const registered = await registerPushDevice({
        expoPushToken,
        platform: "android",
        deviceName: getDeviceName(),
        appVersion: Constants.expoConfig?.version ?? null,
      });

      set({
        expoPushToken: registered.expoPushToken,
        preference: registered.preference,
        permissionStatus,
        updatingPreference: false,
      });
    } catch (error) {
      const message = normalizeErrorMessage(error, "更新推送偏好失败");
      logWarn("pushStore", "updatePreference 失败", {
        error: message,
        userId,
        patch,
      });
      set({ updatingPreference: false, error: message });
      throw error;
    }
  },

  reset: () =>
    set({
      supported: isPushPlatformSupported(),
      isDevice: isPhysicalDevice(),
      permissionStatus: isPushPlatformSupported() ? "undetermined" : "unavailable",
      expoPushToken: null,
      preference: null,
      bootstrapping: false,
      updatingPreference: false,
      error: null,
    }),
}));
