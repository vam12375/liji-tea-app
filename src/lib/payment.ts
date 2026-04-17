import { invokeSupabaseFunctionStrict } from "@/lib/supabaseFunction";
import type {
  MockPaymentConfirmResponse,
  PaymentChannel,
} from "@/types/payment";

// 用户端仅保留模拟支付确认；物流履约推进属于商家端职责，不再在 App 内暴露。
export async function confirmMockPayment(
  orderId: string,
  paymentChannel: PaymentChannel,
) {
  return invokeSupabaseFunctionStrict<MockPaymentConfirmResponse>(
    "mock-payment-confirm",
    {
      authMode: "session",
      fallbackMessage: "模拟支付失败。",
      invalidDataMessage: "服务端返回的模拟支付结果不完整。",
      validate: (data: MockPaymentConfirmResponse | null) =>
        Boolean(data?.orderId),
      body: { orderId, paymentChannel },
    },
  );
}
