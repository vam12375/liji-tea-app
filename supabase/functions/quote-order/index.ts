import { resolveCouponPricingForUser } from "../_shared/coupon.ts";
import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import { calculateOrderPricing } from "../_shared/payment.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// 询价接口只接受白名单内的配送方式，避免客户端传入非法枚举值。
const DELIVERY_TYPES = new Set(["standard", "express"]);

interface QuoteOrderItemInput {
  productId: string;
  quantity: number;
}

interface QuoteOrderRequestBody {
  items?: QuoteOrderItemInput[];
  deliveryType?: string;
  giftWrap?: boolean;
  userCouponId?: string;
}

interface ProductRow {
  id: string;
  name: string | null;
  price: number | string | null;
  stock: number | null;
  is_active: boolean | null;
}

type NormalizeItemsResult =
  | {
      items: QuoteOrderItemInput[];
    }
  | {
      error: string;
    };

// 兼容数据库 numeric / text 返回值，统一转成 number 参与金额计算。
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

// 合并重复商品并校验数量，确保询价与正式下单使用同一套商品输入规则。
function normalizeItems(items: QuoteOrderItemInput[]): NormalizeItemsResult {
  const merged = new Map<string, number>();

  for (const item of items) {
    const productId = item.productId?.trim();
    const quantity = Number(item.quantity);

    if (!productId) {
      return { error: "商品标识无效。" };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "商品数量必须为大于 0 的整数。" };
    }

    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }

  return {
    items: Array.from(merged.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    })),
  };
}

// 实时询价入口：不创建订单，只返回服务端校验后的最新金额结构。
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse("仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    const body = (await req.json().catch(() => null)) as QuoteOrderRequestBody | null;
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const deliveryType =
      typeof body?.deliveryType === "string" ? body.deliveryType.trim() : "";
    const giftWrap = body?.giftWrap === true;
    const userCouponId =
      typeof body?.userCouponId === "string" ? body.userCouponId.trim() : "";

    if (rawItems.length === 0) {
      return errorResponse("订单商品不能为空。", 400, "empty_items");
    }

    if (!DELIVERY_TYPES.has(deliveryType)) {
      return errorResponse("配送方式无效。", 400, "invalid_delivery_type");
    }

    const normalized = normalizeItems(rawItems);
    if ("error" in normalized) {
      return errorResponse(normalized.error, 400, "invalid_items");
    }

    const supabase = createServiceClient();
    const productIds = normalized.items.map((item) => item.productId);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, stock, is_active")
      .in("id", productIds);

    if (productsError) {
      return errorResponse(
        "读取商品信息失败。",
        500,
        "products_query_failed",
        productsError.message,
      );
    }

    const typedProducts = (products ?? []) as ProductRow[];
    const productMap = new Map<string, ProductRow>(
      typedProducts.map((product: ProductRow) => [product.id, product]),
    );

    const pricingItems: { quantity: number; unit_price: number }[] = [];

    for (const item of normalized.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return errorResponse("部分商品不存在或已下架。", 422, "product_not_found");
      }

      if (product.is_active !== true) {
        return errorResponse(
          `商品 ${product.name ?? item.productId} 已下架，暂时无法下单。`,
          422,
          "product_inactive",
        );
      }

      if (typeof product.stock === "number" && product.stock < item.quantity) {
        return errorResponse(
          `商品 ${product.name ?? item.productId} 库存不足。`,
          422,
          "insufficient_stock",
        );
      }

      pricingItems.push({
        quantity: item.quantity,
        unit_price: toNumber(product.price),
      });
    }

    // 先计算不含优惠券的基础金额，未登录用户也可以完成这一步。
    const basePricing = calculateOrderPricing(pricingItems, deliveryType, giftWrap);

    if (!userCouponId) {
      return jsonResponse(basePricing);
    }

    // 只有在用户尝试使用已领取优惠券时，才需要校验登录态和用户身份。
    const user = await getUserFromRequest(req);
    if (!user) {
      return errorResponse("未登录或登录状态已失效。", 401, "unauthorized");
    }

    const couponPricing = await resolveCouponPricingForUser({
      userId: user.id,
      userCouponId,
      context: {
        subtotal: basePricing.subtotal,
        shipping: basePricing.shipping,
        autoDiscount: basePricing.autoDiscount,
        giftWrapFee: basePricing.giftWrapFee,
      },
    });

    if (couponPricing.error || !couponPricing.data) {
      return errorResponse(
        couponPricing.error ?? "优惠券校验失败。",
        422,
        "invalid_coupon",
      );
    }

    // 将优惠券结果重新并入订单金额，返回给结算页实时展示。
    return jsonResponse(
      calculateOrderPricing(pricingItems, deliveryType, giftWrap, {
        couponDiscount: couponPricing.data.couponDiscount,
        appliedCoupon: couponPricing.data.appliedCoupon,
      }),
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "计算订单金额失败。",
      500,
      "internal_error",
    );
  }
});
