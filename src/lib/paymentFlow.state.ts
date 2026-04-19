import type { PaymentPhase } from "@/constants/payment";

import type { PaymentExecutionCallbacks } from "./paymentFlow.types";

/**
 * 支付阶段的合法跳转表，作为轻量有限状态机的核心约束。
 * 页面仍可保留 confirm 展示态，而纯执行流程默认从 idle 开始推进。
 */
export const PAYMENT_PHASE_TRANSITIONS: Record<
  PaymentPhase,
  readonly PaymentPhase[]
> = {
  idle: ["confirm", "creating_order", "failed"],
  confirm: ["creating_order", "failed"],
  creating_order: ["invoking_sdk", "waiting_confirm", "success", "failed"],
  invoking_sdk: ["waiting_confirm", "success", "failed"],
  waiting_confirm: ["success", "failed"],
  success: [],
  failed: ["confirm", "creating_order"],
};

/** 校验支付阶段是否允许从当前状态跳到下一个状态。 */
export function canTransitionPaymentPhase(
  from: PaymentPhase,
  to: PaymentPhase,
) {
  return from === to || PAYMENT_PHASE_TRANSITIONS[from].includes(to);
}

/** 支付状态非法跳转时抛出明确错误，便于测试和问题排查。 */
function createInvalidTransitionError(from: PaymentPhase, to: PaymentPhase) {
  return new Error(`支付状态非法跳转：${from} -> ${to}`);
}

/**
 * 为整条支付流程创建一个受控的 phase controller。
 * 这样无论是 executor 内部还是总控逻辑触发阶段切换，都走同一套校验。
 */
export function createPhaseController(callbacks: PaymentExecutionCallbacks) {
  const rawOnPhaseChange = callbacks.onPhaseChange;
  let currentPhase: PaymentPhase = "idle";

  rawOnPhaseChange(currentPhase);

  const transitionTo = (nextPhase: PaymentPhase) => {
    if (!canTransitionPaymentPhase(currentPhase, nextPhase)) {
      throw createInvalidTransitionError(currentPhase, nextPhase);
    }

    currentPhase = nextPhase;
    rawOnPhaseChange(nextPhase);
  };

  const runtimeCallbacks: PaymentExecutionCallbacks = {
    ...callbacks,
    onPhaseChange: transitionTo,
  };

  return {
    transitionTo,
    runtimeCallbacks,
    getCurrentPhase: () => currentPhase,
  };
}
