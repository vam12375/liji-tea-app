import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

import type { AlipayNativePayResult } from "@/types/payment";

interface AlipayNativeModule {
  isAvailable: () => boolean;
  pay: (orderString: string) => Promise<AlipayNativePayResult>;
}

const nativeModule = requireOptionalNativeModule<AlipayNativeModule>("LijiAlipay");

export function isAlipayNativeModuleAvailable() {
  if (Platform.OS !== "android") {
    return false;
  }

  if (!nativeModule?.pay || !nativeModule?.isAvailable) {
    return false;
  }

  return nativeModule.isAvailable();
}

export async function invokeAlipayAppPay(orderString: string) {
  if (Platform.OS !== "android") {
    throw new Error("支付宝 App 支付当前仅支持 Android 开发包。");
  }

  if (!nativeModule?.pay) {
    throw new Error(
      "当前开发包尚未集成支付宝原生模块，请先完成 Expo prebuild 和 Android Development Build。"
    );
  }

  if (!nativeModule.isAvailable()) {
    throw new Error(
      "未检测到支付宝 Android SDK，请先将官方 AAR 放入 modules/liji-alipay/android/libs。"
    );
  }

  return nativeModule.pay(orderString);
}
