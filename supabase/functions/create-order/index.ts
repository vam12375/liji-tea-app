declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import {
  lockUserCouponForOrder,
  resolveCouponPricingForUser,
} from "../_shared/coupon.ts";
import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  calculateOrderPricing,
  type OrderPricingLineItem,
} from "../_shared/payment.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

// 仅允许白名单内的支付渠道和配送方式进入服务端创建订单流程。
const PAYMENT_CHANNELS = new Set(["alipay", "wechat", "card"]);
const DELIVERY_TYPES = new Set(["standard", "express"]);

interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

interface CreateOrderRequestBody {
  items?: CreateOrderItemInput[];
  addressId?: string;
  deliveryType?: string;
  paymentMethod?: string;
  notes?: string;
  giftWrap?: boolean;
  userCouponId?: string;
}

interface ProductRow {
  id: string;
  name: string | null;
  price: number | string | null;
  category: string | null;
  stock: number | null;
  is_active: boolean | null;
}

interface CreateOrderRpcRow {
  order_id: string;
  order_no: string | null;
  subtotal: number | string;
  shipping: number | string;
  discount: number | string;
  auto_discount: number | string;
  coupon_discount: number | string;
  gift_wrap_fee: number | string;
  total: number | string;
}

type NormalizeItemsResult =
  | {
      items: CreateOrderItemInput[];
    }
  | {
      error: string;
    };

// 兼容 Supabase numeric / text 字段，统一转成 number 做金额计算。
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

// 合并重复商品并校验数量，避免同一商品被多次传入影响库存预留。
function normalizeItems(items: CreateOrderItemInput[]): NormalizeItemsResult {
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

// 锁券失败时回滚刚创建的订单，并释放此前预留的库存。
async function rollbackCreatedOrder(
  orderId: string,
  userId: string,
) {
  const supabase = createServiceClient();
  const { error: restoreError } = await supabase.rpc(
    "cancel_pending_order_and_restore_stock",
    {
      p_order_id: orderId,
      p_user_id: userId,
      p_payment_status: "closed",
      p_payment_error_code: "coupon_lock_failed",
      p_payment_error_message: "优惠券锁定失败，订单已自动回滚。",
    },
  );

  if (restoreError) {
    return { error: restoreError };
  }

  const { error: deleteError } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId);

  return { error: deleteError };
}

// 创建订单入口：服务端校验商品、重新计价、预留库存，并在需要时锁定优惠券。
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse("仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return errorResponse("未登录或登录状态已失效。", 401, "unauthorized");
    }

    const body = (await req.json().catch(() => null)) as CreateOrderRequestBody | null;
    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const addressId =
      typeof body?.addressId === "string" ? body.addressId.trim() : "";
    const deliveryType =
      typeof body?.deliveryType === "string" ? body.deliveryType.trim() : "";
    const paymentMethod =
      typeof body?.paymentMethod === "string" ? body.paymentMethod.trim() : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    const giftWrap = body?.giftWrap === true;
    const userCouponId =
      typeof body?.userCouponId === "string" ? body.userCouponId.trim() : "";

    if (rawItems.length === 0) {
      return errorResponse("订单商品不能为空。", 400, "empty_items");
    }

    if (!addressId) {
      return errorResponse("缺少收货地址。", 400, "missing_address_id");
    }

    if (!DELIVERY_TYPES.has(deliveryType)) {
      return errorResponse("配送方式无效。", 400, "invalid_delivery_type");
    }

    if (!PAYMENT_CHANNELS.has(paymentMethod)) {
      return errorResponse("支付方式无效。", 400, "invalid_payment_method");
    }

    const normalized = normalizeItems(rawItems);
    if ("error" in normalized) {
      return errorResponse(normalized.error, 400, "invalid_items");
    }

    const supabase = createServiceClient();
    const productIds = normalized.items.map((item) => item.productId);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, category, stock, is_active")
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
      typedProducts.map((product) => [product.id, product]),
    );

    const pricingItems: OrderPricingLineItem[] = [];
    const couponItems: {
      productId: string;
      category: string;
      quantity: number;
      unitPrice: number;
    }[] = [];

    for (const item of normalized.items) {
      const product = productMap.get(item.productId);

      if (!product) {
        return errorResponse(
          "部分商品不存在或已下架。",
          422,
          "product_not_found",
        );
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

 const unitPrice = toNumber(product.price);
      pricingItems.push({
        quantity: item.quantity,
        unit_price: unitPrice,
      });
 couponItems.push({
 productId: item.productId,
        category: product.category ?? "",
        quantity: item.quantity,
 unitPrice,
      });
    }

    // 先基于商品、配送和礼盒选项计算基础价格，再按需叠加优惠券结果。
    const basePricing = calculateOrderPricing(
      pricingItems,
      deliveryType,
      giftWrap,
    );

    let pricing = basePricing;

    if (userCouponId) {
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
          couponPricing.error ?? "优惠券校验失败。",
          422,
          "invalid_coupon",
        );
      }

      pricing = calculateOrderPricing(pricingItems, deliveryType, giftWrap, {
        couponDiscount: couponPricing.data.couponDiscount,
        appliedCoupon: couponPricing.data.appliedCoupon,
      });
    }

    if (pricing.total <= 0) {
      return errorResponse("订单金额异常，无法创建订单。", 422, "invalid_total");
    }

    // 通过数据库 RPC 原子创建订单并预留库存，避免并发超卖。
    const { data, error } = await supabase.rpc(
      "create_order_with_reserved_stock",
      {
        p_user_id: user.id,
        p_address_id: addressId,
        p_delivery_type: deliveryType,
        p_payment_method: paymentMethod,
        p_notes: notes || null,
        p_gift_wrap: giftWrap,
        p_coupon_id: pricing.appliedCoupon?.couponId ?? null,
        p_user_coupon_id: pricing.appliedCoupon?.userCouponId ?? null,
        p_coupon_code: pricing.appliedCoupon?.code ?? null,
        p_coupon_title: pricing.appliedCoupon?.title ?? null,
        p_coupon_discount: pricing.couponDiscount,
        p_items: normalized.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    );

    if (error) {
      return errorResponse(
        error.message || "创建订单失败。",
        422,
        "create_order_with_reserved_stock_failed",
      );
    }

    const order = (Array.isArray(data) ? data[0] : data) as
      | CreateOrderRpcRow
      | null
      | undefined;

    if (!order?.order_id) {
      return errorResponse(
        "服务端未返回完整的订单结果。",
        500,
        "invalid_order_result",
      );
    }

    // 订单创建成功后再锁定用户券，确保券与订单建立一对一占用关系。
    if (pricing.appliedCoupon?.userCouponId) {
      const lockResult = await lockUserCouponForOrder({
        userId: user.id,
        userCouponId: pricing.appliedCoupon.userCouponId,
        orderId: order.order_id,
      });

      if (lockResult.error) {
        const rollbackResult = await rollbackCreatedOrder(order.order_id, user.id);

        if (rollbackResult.error) {
          return errorResponse(
            "优惠券锁定失败，且订单回滚失败。",
            500,
            "order_rollback_failed",
            rollbackResult.error.message,
          );
        }

        return errorResponse(lockResult.error, 409, "coupon_lock_failed");
      }
    }

    // 返回给客户端的是服务端最终确认后的金额结构，前端只负责展示和跳转。
    return jsonResponse({
      orderId: order.order_id,
      orderNo: order.order_no,
      subtotal: toNumber(order.subtotal),
      shipping: toNumber(order.shipping),
      discount: toNumber(order.discount),
      autoDiscount: toNumber(order.auto_discount),
      couponDiscount: toNumber(order.coupon_discount),
      giftWrapFee: toNumber(order.gift_wrap_fee),
      total: toNumber(order.total),
      appliedCoupon: pricing.appliedCoupon,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "创建订单失败。",
      500,
      "internal_error",
    );
  }
});
