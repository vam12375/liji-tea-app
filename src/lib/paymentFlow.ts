import { paymentCopy } from "@/constants/copy";
import { isMockPaymentChannel } from "@/lib/paymentConfig";
import type { PaymentPhase } from "@/constants/payment";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/logger";
import type {
  AlipayCreateOrderResponse,
  AlipayNativePayResult,
  MockPaymentConfirmResponse,
  PaymentChannel,
  PaymentOrderStatusResponse,
} from "@/types/payment";

/** 页面层透出的支付回调，统一同步支付阶段、金额、单号和副作用。 */
export interface PaymentExecutionCallbacks {
  onPhaseChange: (phase: PaymentPhase) => void;
  onAmountUpdate?: (amount: number) => void;
  onTradeNoUpdate: (tradeNo: string | null) => void;
  onNativeResult?: (result: AlipayNativePayResult | null) => void;
  onCartClear?: () => void | Promise<void>;
  onOrdersRefresh?: () => void | Promise<void>;
}

/** 支付执行器上下文，给不同渠道的 executor 共享统一输入。 */
export interface PaymentExecutorContext {
  orderId: string;
  paymentMethod: PaymentChannel;
  callbacks: PaymentExecutionCallbacks;
  transitionTo: (phase: PaymentPhase) => void;
  dependencies: PaymentExecutionDependencies;
}

/** 执行器输出统一收口为金额、支付单号和可选的原生结果。 */
export interface PaymentExecutorResult {
  amount?: number | string | null;
  outTradeNo?: string | null;
  nativeResult?: AlipayNativePayResult | null;
  paymentStatus?: PaymentOrderStatusResponse | MockPaymentConfirmResponse | null;
}

/** 每一种支付渠道都通过同样的 executor 签名运行。 */
export type PaymentExecutor = (
  context: PaymentExecutorContext,
) => Promise<PaymentExecutorResult>;

/** 当前项目的支付执行器集合：支付宝真实链路 + mock 链路。 */
export interface PaymentExecutors {
  alipay: PaymentExecutor;
  mock: PaymentExecutor;
}

/**
 * 支付流依赖项统一抽象出来，便于测试替换真实依赖。
 * 这样页面层不需要知道支付宝和 mock 的底层请求细节。
 */
export interface PaymentExecutionDependencies {
  createAlipayOrder: (orderId: string) => Promise<AlipayCreateOrderResponse>;
  invokeAlipayAppPay: (orderString: string) => Promise<AlipayNativePayResult>;
  waitForPaymentConfirmation: (
    orderId: string,
  ) => Promise<PaymentOrderStatusResponse>;
  confirmMockPayment: (orderId: string) => Promise<MockPaymentConfirmResponse>;
}

/** 支付流程执行结果，供页面决定后续展示或弹窗。 */
export interface PaymentExecutionResult {
  success: boolean;
  message?: string;
  phase: PaymentPhase;
}

/**
 * 支付阶段的合法跳转表，作为轻量有限状态机的核心约束。
 * 页面仍可保留 confirm 展示态，而纯执行流程默认从 idle 开始推进。
 */
export const PAYMENT_PHASE_TRANSITIONS: Record<PaymentPhase, readonly PaymentPhase[]> = {
  idle: ["confirm", "creating_order", "failed"],
  confirm: ["creating_order", "failed"],
  creating_order: ["invoking_sdk", "waiting_confirm", "success", "failed"],
  invoking_sdk: ["waiting_confirm", "success", "failed"],
  waiting_confirm: ["success", "failed"],
  success: [],
  failed: ["confirm", "creating_order"],
};

/**
 * 默认支付依赖改为按需懒加载，避免纯 Node 测试在导入本文件时提前加载 React Native 运行时代码。
 * 这样 [`tests/run-tests.ts`](tests/run-tests.ts) 只要没有真正触发真实支付依赖，就可以直接执行纯函数测试。
 */
export const defaultPaymentExecutionDependencies: PaymentExecutionDependencies = {
  createAlipayOrder: async (orderId) => {
    const { createAlipayOrder } = await import("@/lib/alipay");
    return createAlipayOrder(orderId);
  },
  invokeAlipayAppPay: async (orderString) => {
    const { invokeAlipayAppPay } = await import("@/lib/alipayNative");
    return invokeAlipayAppPay(orderString);
  },
  waitForPaymentConfirmation: async (orderId) => {
    const { waitForPaymentConfirmation } = await import("@/lib/alipay");
    return waitForPaymentConfirmation(orderId);
  },
  confirmMockPayment: async (orderId) => {
    const { confirmMockPayment } = await import("@/lib/payment");
    return confirmMockPayment(orderId);
  },
};

/** 统一将未知错误转换成用户可见文案。 */
function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return paymentCopy.messages.fallbackFailed;
}

/** 服务端或路由传入的金额可能是 number / string，这里统一归一化。 */
function normalizeAmount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

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
function createPhaseController(callbacks: PaymentExecutionCallbacks) {
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

/**
 * 当前工程仅有支付宝真实链路，其余渠道在客户端层统一走 mock 执行器。
 * 后续如果微信或银行卡接入真实 SDK，只需要在这里继续扩展分发即可。
 */
export function resolvePaymentExecutor(
  paymentMethod: PaymentChannel,
  isMockChannel: boolean,
  executors: PaymentExecutors,
): PaymentExecutor {
  if (paymentMethod === "alipay" && !isMockChannel) {
    return executors.alipay;
  }

  if (isMockChannel) {
    return executors.mock;
  }

  throw new Error(`支付渠道 ${paymentMethod} 尚未接入可执行的支付链路。`);
}

/**
 * 支付宝真实链路执行器：创建支付单、唤起 SDK、等待服务端确认。
 * 页面层只需要订阅 phase 和展示状态，不再直接编排所有细节。
 */
export const alipayPaymentExecutor: PaymentExecutor = async ({
  orderId,
  callbacks,
  transitionTo,
  dependencies,
}) => {
  transitionTo("creating_order");

  const createResult = await dependencies.createAlipayOrder(orderId);
  const amount = normalizeAmount(createResult.amount);
  if (amount !== null) {
    callbacks.onAmountUpdate?.(amount);
  }
  callbacks.onTradeNoUpdate(createResult.outTradeNo);

  transitionTo("invoking_sdk");

  const nativeResult = await dependencies.invokeAlipayAppPay(createResult.orderString);
  callbacks.onNativeResult?.(nativeResult);

  if (nativeResult.resultStatus === "6001") {
    track("payment_cancelled", { orderId, paymentMethod: "alipay" });
    throw new Error("你已取消本次支付宝支付。");
  }

  if (nativeResult.resultStatus !== "9000" && nativeResult.resultStatus !== "8000") {
    throw new Error(
      nativeResult.memo || `支付宝 SDK 返回了未完成状态：${nativeResult.resultStatus}`,
    );
  }

  transitionTo("waiting_confirm");

  const paymentStatus = await dependencies.waitForPaymentConfirmation(orderId);
  if (
    paymentStatus.status === "paid" ||
    paymentStatus.paymentStatus === "success"
  ) {
    return {
      amount: createResult.amount,
      outTradeNo: createResult.outTradeNo,
      nativeResult,
      paymentStatus,
    };
  }

  if (paymentStatus.paymentStatus === "closed") {
    throw new Error("支付单已关闭，请返回订单页后重新发起支付。");
  }

  if (paymentStatus.paymentStatus === "failed") {
    throw new Error(
      paymentStatus.paymentErrorMessage || "服务端确认支付失败，请稍后重试。",
    );
  }

  throw new Error("暂未收到服务端成功确认，请稍后在订单列表中刷新查看。");
};

/** mock 支付执行器：直接调用服务端模拟支付并返回结果。 */
export const mockPaymentExecutor: PaymentExecutor = async ({
  orderId,
  callbacks,
  transitionTo,
  dependencies,
}) => {
  transitionTo("creating_order");

  const result = await dependencies.confirmMockPayment(orderId);
  if (typeof result.paidAmount === "number") {
    callbacks.onAmountUpdate?.(result.paidAmount);
  }
  callbacks.onTradeNoUpdate(result.outTradeNo ?? null);

  return {
    amount: result.paidAmount,
    outTradeNo: result.outTradeNo,
    paymentStatus: result,
  };
};

/** 默认执行器集合直接导出，供页面和测试复用。 */
export const defaultPaymentExecutors: PaymentExecutors = {
  alipay: alipayPaymentExecutor,
  mock: mockPaymentExecutor,
};

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
    if (currentPhase !== "failed" && canTransitionPaymentPhase(currentPhase, "failed")) {
      transitionTo("failed");
    }

    return {
      success: false,
      message,
      phase: "failed",
    };
  }
}
