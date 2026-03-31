import { supabase } from "@/lib/supabase";
import type {
  AlipayCreateOrderResponse,
  PaymentOrderStatusResponse,
} from "@/types/payment";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 从 Supabase FunctionsHttpError 中提取服务端返回的实际错误信息。 */
async function getFunctionErrorMessage(error: unknown, fallback: string) {
  // supabase-js 在非 2xx 响应时返回 FunctionsHttpError，
  // 其 context 是未消费的 Response 对象，message 是固定通用文本。
  if (error && typeof error === "object" && "context" in error) {
    try {
      const response = (error as { context: Response }).context;
      const body = await response.json();
      if (body?.message) {
        return body.message as string;
      }
    } catch {
      // response body 解析失败，回退到 error.message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function createAlipayOrder(orderId: string) {
  const { data, error } = await supabase.functions.invoke<AlipayCreateOrderResponse>(
    "alipay-create-order",
    {
      body: { orderId },
    }
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, "创建支付宝支付单失败。"));
  }

  if (!data?.orderString || !data?.outTradeNo || !data?.amount) {
    throw new Error("服务端返回的支付宝支付单数据不完整。");
  }

  return data;
}

export async function fetchPaymentOrderStatus(orderId: string) {
  const { data, error } = await supabase.functions.invoke<PaymentOrderStatusResponse>(
    "payment-order-status",
    {
      body: { orderId },
    }
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, "查询订单支付状态失败。"));
  }

  if (!data?.orderId) {
    throw new Error("服务端返回的订单支付状态数据不完整。");
  }

  return data;
}

export async function waitForPaymentConfirmation(
  orderId: string,
  options?: { attempts?: number; intervalMs?: number }
) {
  const attempts = options?.attempts ?? 12;
  const intervalMs = options?.intervalMs ?? 2000;

  let lastStatus = await fetchPaymentOrderStatus(orderId);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (lastStatus.status === "paid" || lastStatus.paymentStatus === "success") {
      return lastStatus;
    }

    if (
      lastStatus.paymentStatus === "failed" ||
      lastStatus.paymentStatus === "closed"
    ) {
      return lastStatus;
    }

    if (attempt < attempts - 1) {
      await sleep(intervalMs);
      lastStatus = await fetchPaymentOrderStatus(orderId);
    }
  }

  return lastStatus;
}
