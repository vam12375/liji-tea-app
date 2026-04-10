import { invokeSupabaseFunctionStrict } from '@/lib/supabaseFunction';
import type {
  MockLogisticsAction,
  MockLogisticsUpdateResponse,
  MockPaymentConfirmResponse,
  PaymentChannel,
} from'@/types/payment';

// mock 支付确认显式传入当前选中的渠道，避免补付时仍沿用首次下单方式。
export async function confirmMockPayment(
  orderId: string,
  paymentChannel: PaymentChannel,
) {
  return invokeSupabaseFunctionStrict<MockPaymentConfirmResponse>(
    'mock-payment-confirm',
    {
      authMode: 'session',
      fallbackMessage: '模拟支付失败。',
      invalidDataMessage: '服务端返回的模拟支付结果不完整。',
      validate: (data: MockPaymentConfirmResponse | null) => Boolean(data?.orderId),
      body: { orderId, paymentChannel },
    },
  );
}

// 模拟物流动作与支付一样走统一封装，避免页面直接处理原始响应。
export async function updateMockLogistics(
  orderId: string,
  action: MockLogisticsAction,
) {
  return invokeSupabaseFunctionStrict<MockLogisticsUpdateResponse>(
    'mock-logistics-update',
    {
      authMode: 'session',
      fallbackMessage: '更新模拟物流失败。',
      invalidDataMessage: '服务端返回的模拟物流结果不完整。',
      validate: (data: MockLogisticsUpdateResponse | null)=> Boolean(data?.orderId),
      body: { orderId, action },
    },
  );
}
