import type { PaymentPhase } from "@/constants/payment";
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
  confirmMockPayment: (
    orderId: string,
    paymentChannel: PaymentChannel,
  ) => Promise<MockPaymentConfirmResponse>;
}

/** 支付流程执行结果，供页面决定后续展示或弹窗。 */
export interface PaymentExecutionResult {
  success: boolean;
  message?: string;
  phase: PaymentPhase;
}
