import { Platform } from "react-native";

import { logInfo } from "@/lib/logger";
import { paymentChannelConfig, paymentEnvironment } from "@/lib/paymentConfig";
import {
  getPaymentChannelAvailability,
  getPaymentRuntimeSnapshot,
} from "@/lib/paymentRuntime";

let hasLoggedRuntimeDiagnostics = false;

/** 开发态只输出一次运行环境诊断，避免根布局重复刷屏。 */
export function logRuntimeDiagnostics() {
  if (!__DEV__ || hasLoggedRuntimeDiagnostics) {
    return;
  }

  hasLoggedRuntimeDiagnostics = true;

  const paymentRuntime = getPaymentRuntimeSnapshot();

  logInfo("runtime", "运行环境诊断", {
    platform: Platform.OS,
    appOwnership: paymentRuntime.appOwnership,
    executionEnvironment: paymentRuntime.executionEnvironment,
    isExpoGo: paymentRuntime.isExpoGo,
    isStandaloneApp: paymentRuntime.isStandaloneApp,
    paymentEnvironment,
    paymentChannels: paymentChannelConfig,
    enabledMockChannels: Object.entries(paymentChannelConfig)
      .filter(([, config]) => config.enabled && config.isMock)
      .map(([channel]) => channel),
    hasAlipayNativeModule: paymentRuntime.hasAlipayNativeModule,
    alipayAvailability: getPaymentChannelAvailability("alipay"),
    supabaseUrlSource: "EXPO_PUBLIC_SUPABASE_URL",
  });
}

