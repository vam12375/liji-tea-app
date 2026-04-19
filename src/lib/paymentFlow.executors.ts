import { paymentCopy } from "@/constants/copy";
import { track } from "@/lib/analytics";
import type { PaymentChannel } from "@/types/payment";

import type {
  PaymentExecutionDependencies,
  PaymentExecutor,
  PaymentExecutors,
} from "./paymentFlow.types";

/**
 * 默认支付依赖改为按需懒加载，避免纯 Node 测试在导入本文件时提前加载 React Native 运行时代码。
 * 这样 [`tests/run-tests.ts`](tests/run-tests.ts) 只要没有真正触发真实支付依赖，就可以直接执行纯函数测试。
 */
export const defaultPaymentExecutionDependencies: PaymentExecutionDependencies =
  {
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
    confirmMockPayment: async (orderId, paymentChannel) => {
      const { confirmMockPayment } = await import("@/lib/payment");
      return confirmMockPayment(orderId, paymentChannel);
    },
  };

/** 统一将未知错误转换成用户可见文案。 */
export function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return paymentCopy.messages.fallbackFailed;
}

/** 服务端或路由传入的金额可能是 number / string，这里统一归一化。 */
export function normalizeAmount(value: number | string | null | undefined) {
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

  const nativeResult = await dependencies.invokeAlipayAppPay(
    createResult.orderString,
  );
  callbacks.onNativeResult?.(nativeResult);

  if (nativeResult.resultStatus === "6001") {
    track("payment_cancelled", { orderId, paymentMethod: "alipay" });
    throw new Error("你已取消本次支付宝支付。");
  }

  if (
    nativeResult.resultStatus !== "9000" &&
    nativeResult.resultStatus !== "8000"
  ) {
    throw new Error(
      nativeResult.memo ||
        `支付宝 SDK 返回了未完成状态：${nativeResult.resultStatus}`,
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
  paymentMethod,
  callbacks,
  transitionTo,
  dependencies,
}) => {
  transitionTo("creating_order");

  const result = await dependencies.confirmMockPayment(orderId, paymentMethod);
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
