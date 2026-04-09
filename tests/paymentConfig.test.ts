import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  canUsePaymentChannel,
  getEnabledPaymentChannelsFromConfig,
  resolvePaymentRuntimeConfig,
} from "@/lib/paymentConfig";

/** 支付渠道运行时配置回归测试。 */
export async function runPaymentConfigTests() {
  console.log("[Suite] paymentConfig");

  await runCase("defaults mock-capable channels to disabled outside dev", () => {
    const resolved = resolvePaymentRuntimeConfig({}, false);

    assert.equal(resolved.paymentChannelConfig.alipay.enabled, true);
    assert.equal(resolved.paymentChannelConfig.wechat.enabled, false);
    assert.equal(resolved.paymentChannelConfig.card.enabled, false);
    assert.equal(resolved.mockPaymentChannelsAllowed, false);
    assert.deepEqual(
      getEnabledPaymentChannelsFromConfig(
        resolved.paymentChannelConfig,
        resolved.mockPaymentChannelsAllowed,
      ),
      ["alipay"],
    );
  });

  await runCase("keeps mock channels unavailable when runtime forbids mock payments", () => {
    const resolved = resolvePaymentRuntimeConfig(
      {
        EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED: "true",
        EXPO_PUBLIC_PAYMENT_CARD_ENABLED: "true",
        EXPO_PUBLIC_PAYMENT_ALLOW_MOCK: "false",
      },
      false,
    );

    assert.equal(
      canUsePaymentChannel(
        "wechat",
        resolved.paymentChannelConfig,
        resolved.mockPaymentChannelsAllowed,
      ),
      false,
    );
    assert.equal(
      canUsePaymentChannel(
        "card",
        resolved.paymentChannelConfig,
        resolved.mockPaymentChannelsAllowed,
      ),
      false,
    );
    assert.deepEqual(
      getEnabledPaymentChannelsFromConfig(
        resolved.paymentChannelConfig,
        resolved.mockPaymentChannelsAllowed,
      ),
      ["alipay"],
    );
  });

  await runCase("allows explicitly enabled mock channels when local mock is enabled", () => {
    const resolved = resolvePaymentRuntimeConfig(
      {
        EXPO_PUBLIC_PAYMENT_WECHAT_ENABLED: "true",
        EXPO_PUBLIC_PAYMENT_CARD_ENABLED: "1",
        EXPO_PUBLIC_PAYMENT_ALLOW_MOCK: "1",
      },
      false,
    );

    assert.deepEqual(
      getEnabledPaymentChannelsFromConfig(
        resolved.paymentChannelConfig,
        resolved.mockPaymentChannelsAllowed,
      ),
      ["alipay", "wechat", "card"],
    );
  });
}
