import type { CouponPricingProductItem } from "./coupon.ts";
import {
  formatAmountNumber,
  type OrderPricingLineItem,
} from "./payment.ts";
import { createServiceClient } from "./supabase.ts";

// 前端请求体来自 JSON，数量可能以字符串形式传入；进入计价前统一归一化。
export interface OrderItemInput {
  productId?: string | null;
  quantity?: number | string | null;
}

// 归一化后的商品行只保留 RPC 与计价真正需要的稳定字段。
export interface NormalizedOrderItem {
  productId: string;
  quantity: number;
}

// 商品查询只选择计价、库存校验和优惠券作用域匹配所需字段，避免扩大读取面。
interface ProductRow {
  id: string;
  name: string | null;
  price: number | string | null;
  category: string | null;
  stock: number | null;
  is_active: boolean | null;
}

// 共享模块不直接依赖 HTTP 响应对象，只返回可由调用方转成 errorResponse 的错误结构。
export interface OrderPricingContextError {
  message: string;
  status: number;
  code: string;
  details?: unknown;
}

// 同一份上下文同时服务下单 RPC、基础价格计算和优惠券范围计算。
export interface OrderPricingContext {
  items: NormalizedOrderItem[];
  pricingItems: OrderPricingLineItem[];
  couponItems: CouponPricingProductItem[];
}

type NormalizeOrderItemsResult =
  | {
      items: NormalizedOrderItem[];
    }
  | {
      error: OrderPricingContextError;
    };

export type ResolveOrderPricingContextResult =
  | {
      data: OrderPricingContext;
      error: null;
    }
  | {
      data: null;
      error: OrderPricingContextError;
    };

// 输入格式错误统一返回 400，便于询价与下单保持一致的客户端提示。
function invalidItemsError(message: string): OrderPricingContextError {
  return {
    message,
    status: 400,
    code: "invalid_items",
  };
}

// 商品存在性、上下架和库存属于业务校验失败，统一映射为 422。
function productValidationError(
  message: string,
  code: string,
): OrderPricingContextError {
  return {
    message,
    status: 422,
    code,
  };
}

/**
 * 合并重复商品并校验数量。
 * 询价与正式下单必须复用同一套输入规则，避免两条链路规则漂移。
 */
export function normalizeOrderItems(
  items: OrderItemInput[],
): NormalizeOrderItemsResult {
  const merged = new Map<string, number>();

  for (const item of items) {
    const productId =
      typeof item?.productId === "string" ? item.productId.trim() : "";
    const quantity = Number(item?.quantity);

    if (!productId) {
      return { error: invalidItemsError("商品标识无效。") };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: invalidItemsError("商品数量必须为大于 0 的整数。") };
    }

    // 同一商品多次传入时先合并数量，避免绕过库存预留或产生重复订单行。
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }

  return {
    items: Array.from(merged.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    })),
  };
}

/**
 * 读取商品并构建订单计价上下文。
 * 返回值同时包含订单 RPC 所需的规整商品、基础计价行和优惠券作用域上下文。
 */
export async function resolveOrderPricingContext(
  rawItems: OrderItemInput[],
): Promise<ResolveOrderPricingContextResult> {
  const normalized = normalizeOrderItems(rawItems);
  if ("error" in normalized) {
    return { data: null, error: normalized.error };
  }

  // 商品 ID 已去重合并，后续只需一次批量查询即可构建所有计价上下文。
  const productIds = normalized.items.map((item) => item.productId);
  const supabase = createServiceClient();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, category, stock, is_active")
    .in("id", productIds);

  if (productsError) {
    return {
      data: null,
      error: {
        message: "读取商品信息失败。",
        status: 500,
        code: "products_query_failed",
        details: productsError.message,
      },
    };
  }

  // 使用 Map 保持输入商品顺序校验，同时能快速定位缺失或下架商品。
  const typedProducts = (products ?? []) as ProductRow[];
  const productMap = new Map<string, ProductRow>(
    typedProducts.map((product) => [product.id, product]),
  );

  const pricingItems: OrderPricingLineItem[] = [];
  const couponItems: CouponPricingProductItem[] = [];

  for (const item of normalized.items) {
    const product = productMap.get(item.productId);

    if (!product) {
      return {
        data: null,
        error: productValidationError(
          "部分商品不存在或已下架。",
          "product_not_found",
        ),
      };
    }

    if (product.is_active !== true) {
      return {
        data: null,
        error: productValidationError(
          `商品 ${product.name ?? item.productId} 已下架，暂时无法下单。`,
          "product_inactive",
        ),
      };
    }

    if (typeof product.stock === "number" && product.stock < item.quantity) {
      return {
        data: null,
        error: productValidationError(
          `商品 ${product.name ?? item.productId} 库存不足。`,
          "insufficient_stock",
        ),
      };
    }

    // 数据库 numeric 可能返回字符串；这里统一格式化为两位金额数值，避免两条链路精度漂移。
    const unitPrice = formatAmountNumber(product.price);
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

  return {
    data: {
      items: normalized.items,
      pricingItems,
      couponItems,
    },
    error: null,
  };
}
