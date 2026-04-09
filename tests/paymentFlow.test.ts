import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import type { PaymentPhase } from "@/constants/payment";
import {
  canTransitionPaymentPhase,
  executePaymentByChannel,
  resolvePaymentExecutor,
} from "@/lib/paymentFlow";

/** 支付状态机与执行器分发测试。 */
export async function runPaymentFlowTests() {
  console.log("[Suite] paymentFlow");

  await runCase("resolves executor by channel and mock flag", () => {
    const executors = {
      alipay: async () => ({ amount: 1, outTradeNo: "ali-1" }),
      mock: async () => ({ amount: 1, outTradeNo: "mock-1" }),
    };

    assert.equal(
      resolvePaymentExecutor("alipay", false, executors),
      executors.alipay,
    );
    assert.equal(
      resolvePaymentExecutor("wechat", true, executors),
      executors.mock,
    );
  });

  await runCase("validates payment phase transitions", () => {
    assert.equal(canTransitionPaymentPhase("idle", "creating_order"), true);
    assert.equal(canTransitionPaymentPhase("creating_order", "waiting_confirm"), true);
    assert.equal(canTransitionPaymentPhase("success", "failed"), false);
  });

  await runCase("fails fast when order id is missing", async () => {
    const phases: PaymentPhase[] = [];

    const result = await executePaymentByChannel(
      "",
      "alipay",
      true,
      false,
      {
        onPhaseChange: (phase) => phases.push(phase),
        onAmountUpdate: () => undefined,
        onTradeNoUpdate: () => undefined,
      },
    );

    assert.equal(result.success, false);
    assert.equal(result.message, "缺少订单编号，无法发起支付。");
    assert.deepEqual(phases, ["idle", "failed"]);
  });

  await runCase("fails fast when payment channel is disabled", async () => {
    const phases: PaymentPhase[] = [];

    const result = await executePaymentByChannel(
      "order-disabled",
      "alipay",
      false,
      false,
      {
        onPhaseChange: (phase) => phases.push(phase),
        onAmountUpdate: () => undefined,
        onTradeNoUpdate: () => undefined,
      },
    );

    assert.equal(result.success, false);
    assert.equal(result.message, "当前支付渠道未启用，请返回订单页重新选择。");
    assert.deepEqual(phases, ["idle", "failed"]);
  });

  await runCase("runs successful payment flow with injected executors", async () => {
    const phases: PaymentPhase[] = [];
    let cartCleared = false;
    let ordersRefreshed = false;

    const result = await executePaymentByChannel(
      "order-1",
      "card",
      true,
      true,
      {
        onPhaseChange: (phase) => phases.push(phase),
        onAmountUpdate: () => undefined,
        onTradeNoUpdate: () => undefined,
        onNativeResult: () => undefined,
        onCartClear: () => {
          cartCleared = true;
        },
        onOrdersRefresh: async () => {
          ordersRefreshed = true;
        },
      },
      {
        alipay: async () => ({ amount: 88, outTradeNo: "ali-1" }),
        mock: async ({ callbacks }) => {
          callbacks.onPhaseChange("creating_order");
          callbacks.onTradeNoUpdate("mock-1");
          return { amount: 88, outTradeNo: "mock-1" };
        },
      },
    );

    assert.equal(result.success, true);
    assert.equal(cartCleared, true);
    assert.equal(ordersRefreshed, true);
    assert.deepEqual(phases, ["idle", "creating_order", "success"]);
  });

  await runCase("returns failed result when executor throws", async () => {
    const phases: PaymentPhase[] = [];
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      const result = await executePaymentByChannel(
        "order-2",
        "wechat",
        true,
        false,
        {
          onPhaseChange: (phase) => phases.push(phase),
          onAmountUpdate: () => undefined,
          onTradeNoUpdate: () => undefined,
          onNativeResult: () => undefined,
          onOrdersRefresh: async () => undefined,
        },
        {
          alipay: async () => ({ amount: 88, outTradeNo: "ali-1" }),
          mock: async () => {
            throw new Error("模拟支付失败");
          },
        },
      );

      assert.equal(result.success, false);
      assert.equal(result.message, "模拟支付失败");
      assert.deepEqual(phases, ["idle", "failed"]);
    } finally {
      console.error = originalConsoleError;
    }
  });
}
