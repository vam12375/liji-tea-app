import { invokeSupabaseFunctionStrict } from '@/lib/supabaseFunction';
import type {
  AlipayCreateOrderResponse,
  PaymentOrderStatusResponse,
} from '@/types/payment';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 创建支付宝支付单时统一走严格校验封装，避免页面消费不完整响应。
export async function createAlipayOrder(orderId: string) {
  return invokeSupabaseFunctionStrict<AlipayCreateOrderResponse>(
    'alipay-create-order',
    {
      authMode: 'session',
fallbackMessage: '创建支付宝支付单失败。',
      invalidDataMessage: '服务端返回的支付宝支付单数据不完整。',
      validate: (data: AlipayCreateOrderResponse | null) =>
        Boolean(data?.orderString&& data?.outTradeNo && data?.amount),
      body: { orderId },
    },
  );
}

// 查询订单支付状态时统一复用严格调用层，减少各处重复判空。
export async function fetchPaymentOrderStatus(orderId: string) {
  return invokeSupabaseFunctionStrict<PaymentOrderStatusResponse>(
    'payment-order-status',
    {
      authMode: 'session',
      fallbackMessage: '查询订单支付状态失败。',
      invalidDataMessage: '服务端返回的订单支付状态数据不完整。',
      validate: (data: PaymentOrderStatusResponse | null) => Boolean(data?.orderId),
      body: { orderId },
    },
  );
}

// 支付宝支付完成后轮询服务端确认，直到成功、失败或超时结束。
export async function waitForPaymentConfirmation(
  orderId: string,
  options?: { attempts?: number; intervalMs?: number },
) {
  const attempts = options?.attempts ?? 12;
  const intervalMs = options?.intervalMs ?? 2000;

  let lastStatus = await fetchPaymentOrderStatus(orderId);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (lastStatus.status === 'paid' || lastStatus.paymentStatus === 'success') {
      return lastStatus;
    }

    if (
      lastStatus.paymentStatus === 'failed' ||
      lastStatus.paymentStatus === 'closed'
    ) {
      return lastStatus;
    }

    if (attempt < attempts - 1) {
      await sleep(intervalMs);
      lastStatus= await fetchPaymentOrderStatus(orderId);
    }
  }

  return lastStatus;
}
