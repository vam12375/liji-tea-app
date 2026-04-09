import { invokeSupabaseFunctionStrict } from '@/lib/supabaseFunction';
import type {
  MockLogisticsAction,
  MockLogisticsUpdateResponse,
  MockPaymentConfirmResponse,
} from'@/types/payment';

// mock 支付确认统一走严格调用层，便于和真实链路保持相同错误语义。
export async function confirmMockPayment(orderId: string) {
  return invokeSupabaseFunctionStrict<MockPaymentConfirmResponse>(
    'mock-payment-confirm',
    {
      authMode: 'session',
      fallbackMessage: '模拟支付失败。',
      invalidDataMessage: '服务端返回的模拟支付结果不完整。',
      validate: (data: MockPaymentConfirmResponse | null) => Boolean(data?.orderId),
      body: { orderId },
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
