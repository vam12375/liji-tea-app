import { resolveCouponPricingForUser } from "../_shared/coupon.ts";
import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  resolveOrderPricingContext,
  type OrderItemInput,
} from "../_shared/orderPricingContext.ts";
import { calculateOrderPricing } from "../_shared/payment.ts";
import {
  enforceAnonymousRateLimit,
  enforceRateLimit,
  rateLimitedResponse,
  resolveClientIpKey,
} from "../_shared/rateLimit.ts";
import { getUserFromRequest } from "../_shared/supabase.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// 询价接口只接受白名单内的配送方式，避免客户端传入非法枚举值。
const DELIVERY_TYPES = new Set(["standard", "express"]);

interface QuoteOrderRequestBody {
  items?: OrderItemInput[];
  deliveryType?: string;
  giftWrap?: boolean;
  userCouponId?: string;
}

// 实时询价入口：不创建订单，只返回服务端校验后的最新金额结构。
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse(req, "仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    // 询价允许匿名（未登录也能看到基础金额），因此限流按 IP 维度防爆破；
    // 后文若进入 userCouponId 分支还会再做一次 userId 维度限流，避免登录用户刷券计算。
    const ipKey = await resolveClientIpKey(req);
    if (ipKey) {
      const rateLimit = await enforceAnonymousRateLimit(ipKey, {
        bucket: "quote-order",
        max: 30,
        windowSec: 60,
      });
      if (!rateLimit.allowed) {
        return rateLimitedResponse(req, rateLimit.retryAfterSec);
      }
    }

    const body = (await req.json().catch(() => null)) as QuoteOrderRequestBody | null;
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const deliveryType =
      typeof body?.deliveryType === "string" ? body.deliveryType.trim() : "";
    const giftWrap = body?.giftWrap === true;
    const userCouponId =
      typeof body?.userCouponId === "string" ? body.userCouponId.trim() : "";

    if (rawItems.length === 0) {
      return errorResponse(req, "订单商品不能为空。", 400, "empty_items");
    }

    if (!DELIVERY_TYPES.has(deliveryType)) {
      return errorResponse(req, "配送方式无效。", 400, "invalid_delivery_type");
    }

    // 与正式下单共用商品规整和库存校验，避免询价成功但下单因规则漂移失败。
    const orderContext = await resolveOrderPricingContext(rawItems);
    if (orderContext.error) {
      return errorResponse(
        req,
        orderContext.error.message,
        orderContext.error.status,
        orderContext.error.code,
        orderContext.error.details,
      );
    }

    // pricingItems 用于基础计价，couponItems 用于后续优惠券作用域匹配。
    const { pricingItems, couponItems } = orderContext.data;

    // 先计算不含优惠券的基础金额，未登录用户也可以完成这一步。
    const basePricing = calculateOrderPricing(pricingItems, deliveryType, giftWrap);

    if (!userCouponId) {
      return jsonResponse(req, basePricing);
    }

    // 只有在用户尝试使用已领取优惠券时，才需要校验登录态和用户身份。
    const user = await getUserFromRequest(req);
    if (!user) {
      return errorResponse(req, "未登录或登录状态已失效。", 401, "unauthorized");
    }

    // 带券询价再叠加登录态维度限流：同一用户 60 秒内最多 60 次（结算页可能频繁刷新）。
    const userRateLimit = await enforceRateLimit(user.id, {
      bucket: "quote-order:coupon",
      max: 60,
      windowSec: 60,
    });
    if (!userRateLimit.allowed) {
      return rateLimitedResponse(req, userRateLimit.retryAfterSec);
    }

    const couponPricing = await resolveCouponPricingForUser({
      userId: user.id,
      userCouponId,
      context: {
        subtotal: basePricing.subtotal,
        shipping: basePricing.shipping,
        autoDiscount: basePricing.autoDiscount,
        giftWrapFee: basePricing.giftWrapFee,
        items: couponItems,
      },
    });

    if (couponPricing.error || !couponPricing.data) {
      return errorResponse(
        req,
        couponPricing.error ?? "优惠券校验失败。",
        422,
        "invalid_coupon",
      );
    }

    // 将优惠券结果重新并入订单金额，返回给结算页实时展示。
    return jsonResponse(
      req,
      calculateOrderPricing(pricingItems, deliveryType, giftWrap, {
        couponDiscount: couponPricing.data.couponDiscount,
        appliedCoupon: couponPricing.data.appliedCoupon,
      }),
    );
  } catch (error) {
    return errorResponse(
      req,
      error instanceof Error ? error.message : "计算订单金额失败。",
      500,
      "internal_error",
    );
  }
});
