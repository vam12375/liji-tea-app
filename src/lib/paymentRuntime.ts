import Constants from "expo-constants";

import { isAlipayNativeModuleAvailable } from "@/lib/alipayNative";
import type { PaymentChannel } from "@/types/payment";

export function getPaymentRuntimeSnapshot() {
  const appOwnership = Constants.appOwnership ?? null;
  const executionEnvironment = Constants.executionEnvironment ?? null;
  const isExpoGo =
    executionEnvironment === "storeClient" || appOwnership === "expo";
  const isStandaloneApp = executionEnvironment === "standalone";

  return {
    appOwnership,
    executionEnvironment,
    isExpoGo,
    isStandaloneApp,
    hasAlipayNativeModule: isAlipayNativeModuleAvailable(),
  };
}

export function getPaymentChannelAvailability(channel: PaymentChannel) {
  if (channel === "alipay") {
    const available = isAlipayNativeModuleAvailable();

    return {
      channel,
      available,
      reason: available ? "native_module_ready" : "native_module_missing",
    };
  }

  return {
    channel,
    available: true,
    reason: "mock_channel",
  };
}
