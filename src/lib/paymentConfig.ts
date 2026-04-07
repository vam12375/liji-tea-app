import type { PaymentChannel } from "@/types/payment";

function readBooleanFlag(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export const paymentChannelConfig = {
  alipay: {
    enabled: readBooleanFlag(
      process.env.EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED,
      true,
    ),
    isMock: false,
  },
  wechat: {
    enabled: readBooleanFlag(
      process.env.EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED,
      false,
    ),
    isMock: true,
  },
  card: {
    enabled: readBooleanFlag(
      process.env.EXPO_PUBLIC_PAYMENT_CARD_ENABLED,
      false,
    ),
    isMock: true,
  },
} as const satisfies Record<
  PaymentChannel,
  {
    enabled: boolean;
    isMock: boolean;
  }
>;

export const paymentEnvironment =
  process.env.EXPO_PUBLIC_PAYMENT_ENV?.trim() || "sandbox";

export function isPaymentChannelEnabled(channel: PaymentChannel) {
  return paymentChannelConfig[channel].enabled;
}

export function getEnabledPaymentChannels() {
  return (Object.keys(paymentChannelConfig) as PaymentChannel[]).filter(
    (channel) => paymentChannelConfig[channel].enabled,
  );
}

// 开发模式下检查支付环境变量是否已显式配置
if (__DEV__) {
  const envKeys = [
    "EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED",
    "EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED",
    "EXPO_PUBLIC_PAYMENT_CARD_ENABLED",
    "EXPO_PUBLIC_PAYMENT_ENV",
  ] as const;

  const missing = envKeys.filter((k) => process.env[k] === undefined);
  if (missing.length > 0) {
    console.warn(
      `[paymentConfig] 以下支付环境变量未设置，将使用默认值：\n` +
        missing.map((k) => `  - ${k}`).join("\n"),
    );
  }
}
