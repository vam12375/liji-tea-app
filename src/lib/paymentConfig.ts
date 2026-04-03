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
