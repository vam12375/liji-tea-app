import { supabase } from "@/lib/supabase";
import type { PaymentChannel } from "@/types/payment";

// 统一前后端配送方式枚举，避免页面与 Edge Function 之间出现字符串不一致。
export type DeliveryType = "standard" | "express";

export interface OrderInputItem {
  productId: string;
  quantity: number;
}

export interface AppliedCouponSummary {
  couponId: string;
  userCouponId: string;
  code: string;
  title: string;
  discountType: string;
  discountValue: number;
  minSpend: number;
  maxDiscount: number | null;
  discountAmount: number;
}

export interface OrderPricingQuote {
  subtotal: number;
  shipping: number;
  discount: number;
  autoDiscount?: number;
  couponDiscount?: number;
  giftWrapFee: number;
  total: number;
  appliedCoupon?: AppliedCouponSummary | null;
}

export interface QuoteOrderParams {
  items: OrderInputItem[];
  deliveryType: DeliveryType;
  giftWrap: boolean;
  userCouponId?: string;
}

export interface CreateOrderParams extends QuoteOrderParams {
  addressId: string;
  paymentMethod: PaymentChannel;
  notes?: string;
}

export interface CreateOrderResponse extends OrderPricingQuote {
  orderId: string;
  orderNo?: string | null;
}

export interface CancelPendingOrderResponse {
  released: boolean;
  orderStatus: string;
  paymentStatus: string;
}

// 从 Supabase Edge Function 的响应中尽量提取更具体的错误信息。
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

// 对服务端返回的金额结构做运行时校验，避免页面使用到不完整数据。
function ensurePricingPayload(
  data: Partial<OrderPricingQuote> | null | undefined,
  fallback: string,
): asserts data is OrderPricingQuote {
  if (
    !data ||
    typeof data.subtotal !== "number" ||
    typeof data.shipping !== "number" ||
    typeof data.discount !== "number" ||
    typeof data.giftWrapFee !== "number" ||
    typeof data.total !== "number"
  ) {
    throw new Error(fallback);
  }
}

// RPC 返回的是弱类型数据，这里补一层类型守卫，保证后续读取安全。
function isCancelPendingOrderResponse(
  value: unknown,
): value is CancelPendingOrderResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "released" in value &&
    "order_status" in value &&
    "payment_status" in value &&
    typeof value.released === "boolean" &&
    typeof value.order_status === "string" &&
    typeof value.payment_status === "string"
  );
}

// 仅做实时询价，不落库，结算页会用它来展示最新的服务端金额。
export async function quoteOrder(params: QuoteOrderParams) {
  const { data, error } = await supabase.functions.invoke<OrderPricingQuote>(
    "quote-order",
    {
      body: {
        items: params.items,
        deliveryType: params.deliveryType,
        giftWrap: params.giftWrap,
        userCouponId: params.userCouponId,
      },
    },
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, "计算订单金额失败。"));
  }

  ensurePricingPayload(data, "服务端返回的订单金额数据不完整。");
  return data;
}

// 正式创建订单时仍由服务端重新验价，客户端提交的金额不作为可信来源。
export async function createOrder(params: CreateOrderParams) {
  const { data, error } = await supabase.functions.invoke<CreateOrderResponse>(
    "create-order",
    {
      body: {
        items: params.items,
        addressId: params.addressId,
        deliveryType: params.deliveryType,
        paymentMethod: params.paymentMethod,
        notes: params.notes,
        giftWrap: params.giftWrap,
        userCouponId: params.userCouponId,
      },
    },
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error, "创建订单失败。"));
  }

  if (!data?.orderId) {
    throw new Error("服务端返回的订单创建结果不完整。");
  }

  ensurePricingPayload(data, "服务端返回的订单金额数据不完整。");
  return data;
}

// 用于关闭超时未支付订单，并同步释放此前预留的库存。
export async function cancelPendingOrderAndRestoreStock(
  orderId: string,
  userId: string,
) {
  const { data, error } = await supabase.rpc(
    "cancel_pending_order_and_restore_stock",
    {
      p_order_id: orderId,
      p_user_id: userId,
      p_payment_status: "closed",
      p_payment_error_code: "order_expired",
      p_payment_error_message: "待付款订单已超过 10 分钟，系统已自动取消。",
    },
  );

  if (error) {
    throw new Error(error.message || "关闭超时订单失败。");
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!isCancelPendingOrderResponse(result)) {
    throw new Error("服务端未返回有效的订单关闭结果。");
  }

  return result;
}
