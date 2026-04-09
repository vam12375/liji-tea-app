import type { PaymentChannel } from "@/types/payment";

type PaymentRuntimeEnv = Record<string, string | undefined>;

export interface PaymentChannelRuntimeConfig {
  enabled: boolean;
  isMock: boolean;
}

export interface ResolvedPaymentRuntimeConfig {
  paymentChannelConfig: Record<PaymentChannel, PaymentChannelRuntimeConfig>;
  paymentEnvironment: string;
  mockPaymentChannelsAllowed: boolean;
}

const isDevRuntime = typeof __DEV__ !== "undefined" && __DEV__;

// 环境变量统一按布尔开关解析，避免不同页面重复处理字符串值。
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

export function resolvePaymentRuntimeConfig(
  env: PaymentRuntimeEnv = process.env,
  isDev = isDevRuntime,
): ResolvedPaymentRuntimeConfig {
  // mock 渠道默认收紧，只有显式启用时才允许对外展示。
  const paymentChannelConfig = {
    alipay: {
      enabled: readBooleanFlag(
        env.EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED,
        true,
      ),
      isMock: false,
    },
    wechat: {
      enabled: readBooleanFlag(
        env.EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED,
        false,
      ),
      isMock: true,
    },
    card: {
      enabled: readBooleanFlag(
        env.EXPO_PUBLIC_PAYMENT_CARD_ENABLED,
        false,
      ),
      isMock: true,
    },
  } as const satisfies Record<PaymentChannel, PaymentChannelRuntimeConfig>;

  return {
    paymentChannelConfig,
    paymentEnvironment: env.EXPO_PUBLIC_PAYMENT_ENV?.trim() || "sandbox",
    mockPaymentChannelsAllowed: readBooleanFlag(
      env.EXPO_PUBLIC_PAYMENT_ALLOW_MOCK,
      isDev,
    ),
  };
}

const resolvedPaymentRuntimeConfig = resolvePaymentRuntimeConfig();

export const paymentChannelConfig =
  resolvedPaymentRuntimeConfig.paymentChannelConfig;

export const paymentEnvironment =
  resolvedPaymentRuntimeConfig.paymentEnvironment;

export const mockPaymentChannelsAllowed =
  resolvedPaymentRuntimeConfig.mockPaymentChannelsAllowed;

export function canUsePaymentChannel(
  channel: PaymentChannel,
  channelConfig = paymentChannelConfig,
  allowMockChannels = mockPaymentChannelsAllowed,
) {
  // 真实开关与 mock 许可都通过这里统一裁决，避免页面层各自判断。
  const config = channelConfig[channel];
  if (!config.enabled) {
    return false;
  }

  if (config.isMock && !allowMockChannels) {
    return false;
  }

  return true;
}

export function getEnabledPaymentChannelsFromConfig(
  channelConfig: Record<PaymentChannel, PaymentChannelRuntimeConfig>,
  allowMockChannels: boolean,
) {
  return (Object.keys(channelConfig) as PaymentChannel[]).filter((channel) =>
    canUsePaymentChannel(channel, channelConfig, allowMockChannels),
  );
}

export function isPaymentChannelEnabled(channel: PaymentChannel) {
  return canUsePaymentChannel(channel);
}

export function isMockPaymentChannel(channel: PaymentChannel) {
  return paymentChannelConfig[channel].isMock;
}

export function getEnabledPaymentChannels() {
  return getEnabledPaymentChannelsFromConfig(
    paymentChannelConfig,
    mockPaymentChannelsAllowed,
  );
}

// 开发模式下检查支付环境变量是否已显式配置
if (isDevRuntime) {
  const envKeys = [
    "EXPO_PUBLIC_PAYMENT_ALIPAY_ENABLED",
    "EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED",
    "EXPO_PUBLIC_PAYMENT_CARD_ENABLED",
    "EXPO_PUBLIC_PAYMENT_ALLOW_MOCK",
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
