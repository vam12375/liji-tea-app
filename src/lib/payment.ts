import { supabase } from "@/lib/supabase";
import type {
    MockLogisticsAction,
    MockLogisticsUpdateResponse,
    MockPaymentConfirmResponse,
} from "@/types/payment";

async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "context" in error) {
    try {
      const response = (error as { context: Response }).context;
      const body = await response.json();
      if (body?.message) {
        return body.message as string;
      }
    } catch {
      // ignore
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function confirmMockPayment(orderId: string) {
  const { data, error } =
    await supabase.functions.invoke<MockPaymentConfirmResponse>(
      "mock-payment-confirm",
      {
        body: { orderId },
      },
    );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, "模拟支付失败。"));
  }

  if (!data?.orderId) {
    throw new Error("服务端返回的模拟支付结果不完整。");
  }

  return data;
}

export async function updateMockLogistics(
  orderId: string,
  action: MockLogisticsAction,
) {
  const { data, error } =
    await supabase.functions.invoke<MockLogisticsUpdateResponse>(
      "mock-logistics-update",
      {
        body: { orderId, action },
      },
    );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, "更新模拟物流失败。"));
  }

  if (!data?.orderId) {
    throw new Error("服务端返回的模拟物流结果不完整。");
  }

  return data;
}
