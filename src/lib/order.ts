import {
  invokeSupabaseFunctionStrict,
  SupabaseFunctionError,
} from "@/lib/supabaseFunction";
import type { PaymentChannel } from "@/types/payment";

// 统一前后端配送方式枚举，避免页面与 Edge Function 之间出现字符串不一致。
export type DeliveryType = "standard" | "express";

export interface OrderInputItem {
  productId: string;
  quantity: number;
}

export type CouponDiscountType = "fixed" | "percent";
export type CouponScope = "all" | "shipping" | "category" | "product";

export interface AppliedCouponSummary {
  couponId: string;
  userCouponId: string;
  code: string;
  title: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minSpend: number;
  maxDiscount: number | null;
  scope: CouponScope;
  scopeCategoryIds?: string[];
  scopeProductIds?: string[];
  eligibleAmount: number;
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

//对服务端返回的金额结构做运行时校验，避免页面使用到不完整数据。
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

//RPC 返回的是弱类型数据，这里补一层类型守卫，保证后续读取安全。
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

//仅做实时询价，不落库，结算页会用它来展示最新的服务端金额。
export async function quoteOrder(params: QuoteOrderParams) {
  const data = await invokeSupabaseFunctionStrict<OrderPricingQuote>("quote-order", {
    authMode: "auto",
    fallbackMessage: "计算订单金额失败。",
    invalidDataMessage: "服务端返回的订单金额数据不完整。",
    validate: (payload) => {
      try {
        ensurePricingPayload(
          payload as Partial<OrderPricingQuote> | null | undefined,
          "服务端返回的订单金额数据不完整。",
        );
        return true;
      } catch {
        return false;
      }
    },
    body: {
      items: params.items,
      deliveryType: params.deliveryType,
      giftWrap: params.giftWrap,
      userCouponId: params.userCouponId,
    },
  });

  ensurePricingPayload(data, "服务端返回的订单金额数据不完整。");
  return data;
}

//正式创建订单时仍由服务端重新验价，客户端提交的金额不作为可信来源。
export async function createOrder(params: CreateOrderParams) {
  const data = await invokeSupabaseFunctionStrict<CreateOrderResponse>("create-order", {
    authMode: "session",
    fallbackMessage: "创建订单失败。",
    invalidDataMessage: "服务端返回的订单创建结果不完整。",
    validate: (payload) => {
      if (!payload?.orderId) {
        return false;
      }

      try {
ensurePricingPayload(
          payload as Partial<OrderPricingQuote> | null | undefined,
          "服务端返回的订单金额数据不完整。",
        );
        return true;
      } catch {
        return false;
      }
    },
    body: {
      items: params.items,
      addressId: params.addressId,
      deliveryType: params.deliveryType,
      paymentMethod: params.paymentMethod,
      notes: params.notes,
      giftWrap: params.giftWrap,
      userCouponId: params.userCouponId,
    },
  });

  if (!data.orderId) {
    throw new SupabaseFunctionError({
kind: "unknown",
      message: "服务端返回的订单创建结果不完整。",
    });
  }

  ensurePricingPayload(data, "服务端返回的订单金额数据不完整。");
  return data;
}

// 用户主动取消订单时，统一走 Edge Function，由服务端再调用 RPC 完成库存回滚与关单。
export async function cancelPendingOrderAndRestoreStock(
  orderId: string,
  _userId: string,
) {
  const data = await invokeSupabaseFunctionStrict<{
    orderId: string;
    released: boolean;
    status: string;
    paymentStatus: string;
  }>("cancel-order", {
    authMode: "session",
    body: { orderId },
    fallbackMessage: "取消订单失败。",
    validate: (payload) =>
      Boolean(
        payload &&
          typeof payload.orderId === "string" &&
          typeof payload.released === "boolean" &&
          typeof payload.status === "string" &&
          typeof payload.paymentStatus === "string",
      ),
    invalidDataMessage: "服务端未返回有效的取消订单结果。",
  });

  if (!isCancelPendingOrderResponse({
    released: data.released,
    order_status: data.status,
    payment_status: data.paymentStatus,
  })) {
    throw new Error("服务端未返回有效的订单关闭结果。");
  }

  return {
    released: data.released,
 order_status: data.status,
    payment_status: data.paymentStatus,
  };
}
