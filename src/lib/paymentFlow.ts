import { paymentCopy } from "@/constants/copy";
import { isMockPaymentChannel } from "@/lib/paymentConfig";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/logger";
import type { PaymentChannel } from "@/types/payment";

import {
  defaultPaymentExecutionDependencies,
  defaultPaymentExecutors,
  normalizeAmount,
  resolvePaymentExecutor,
  toErrorMessage,
} from "./paymentFlow.executors";
import {
  canTransitionPaymentPhase,
  createPhaseController,
} from "./paymentFlow.state";
import type {
  PaymentExecutionCallbacks,
  PaymentExecutionDependencies,
  PaymentExecutionResult,
  PaymentExecutors,
} from "./paymentFlow.types";

// 将拆分后的公共能力重新导出，保证 @/lib/paymentFlow 仍是唯一对外入口，
// 页面层与测试无需调整 import 路径。
export { PAYMENT_PHASE_TRANSITIONS, canTransitionPaymentPhase } from "./paymentFlow.state";
export {
  alipayPaymentExecutor,
  defaultPaymentExecutionDependencies,
  defaultPaymentExecutors,
  mockPaymentExecutor,
  resolvePaymentExecutor,
} from "./paymentFlow.executors";
export type {
  PaymentExecutionCallbacks,
  PaymentExecutionDependencies,
  PaymentExecutionResult,
  PaymentExecutor,
  PaymentExecutorContext,
  PaymentExecutorResult,
  PaymentExecutors,
} from "./paymentFlow.types";

/**
 * 纯函数化的支付执行入口。
 * 页面层调用时只需要传入回调与是否清空购物车，其余流程全部由这里统一编排。
 */
export async function executePaymentByChannel(
  orderId: string,
  paymentMethod: PaymentChannel,
  channelEnabled: boolean,
  shouldClearCart: boolean,
  callbacks: PaymentExecutionCallbacks,
  executors: PaymentExecutors = defaultPaymentExecutors,
  dependencies: PaymentExecutionDependencies = defaultPaymentExecutionDependencies,
): Promise<PaymentExecutionResult> {
  const { transitionTo, runtimeCallbacks, getCurrentPhase } =
    createPhaseController(callbacks);

  if (!orderId) {
    const message = paymentCopy.messages.missingOrderId;
    transitionTo("failed");
    return { success: false, message, phase: getCurrentPhase() };
  }

  if (!channelEnabled) {
    const message = paymentCopy.messages.channelDisabled;
    transitionTo("failed");
    return { success: false, message, phase: getCurrentPhase() };
  }

  track("payment_started", {
    orderId,
    paymentMethod,
    shouldClearCart,
  });

  try {
    const executor = resolvePaymentExecutor(
      paymentMethod,
      isMockPaymentChannel(paymentMethod),
      executors,
    );

    const result = await executor({
      orderId,
      paymentMethod,
      callbacks: runtimeCallbacks,
      transitionTo,
      dependencies,
    });

    const amount = normalizeAmount(result.amount);
    if (amount !== null) {
      runtimeCallbacks.onAmountUpdate?.(amount);
    }

    if (result.outTradeNo !== undefined) {
      runtimeCallbacks.onTradeNoUpdate(result.outTradeNo ?? null);
    }

    if (result.nativeResult !== undefined) {
      runtimeCallbacks.onNativeResult?.(result.nativeResult ?? null);
    }

    if (shouldClearCart) {
      await runtimeCallbacks.onCartClear?.();
    }

    await runtimeCallbacks.onOrdersRefresh?.();

    if (getCurrentPhase() !== "success") {
      transitionTo("success");
    }

    track("payment_succeeded", {
      orderId,
      paymentMethod,
      outTradeNo: result.outTradeNo ?? null,
    });

    return {
      success: true,
      phase: getCurrentPhase(),
    };
  } catch (error: unknown) {
    const message = toErrorMessage(error);

    track("payment_failed", {
      orderId,
      paymentMethod,
      message,
      phase: getCurrentPhase(),
    });
    captureError(error, {
      scope: "paymentFlow",
      message: "executePaymentByChannel 失败",
      orderId,
      paymentMethod,
      phase: getCurrentPhase(),
    });

    const currentPhase = getCurrentPhase();
    if (
      currentPhase !== "failed" &&
      canTransitionPaymentPhase(currentPhase, "failed")
    ) {
      transitionTo("failed");
    }

    return {
      success: false,
      message,
      phase: "failed",
    };
  }
}
