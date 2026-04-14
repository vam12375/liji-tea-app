import { supabase } from "@/lib/supabase";
import type { Order, OrderItem, ProductReview } from "@/types/database";

/** 评价查询字段集合，统一前台页面与 store 的返回结构。 */
export const REVIEW_SELECT = `
  id,
  product_id,
  order_id,
  order_item_id,
  user_id,
  rating,
  content,
  tags,
  images,
  is_anonymous,
  created_at,
  updated_at,
  product:products(id, name, image_url, price, unit),
  user:profiles(id, name, avatar_url)
`;

export interface ReviewAuthor {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface ReviewProductSummary {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  unit: string;
}

export interface ReviewRecord extends ProductReview {
  product?: ReviewProductSummary;
  user?: ReviewAuthor;
}

export interface ReviewDraftInput {
  order: Order;
  orderItem: OrderItem;
  rating: number;
  content: string;
  tags?: string[];
  images?: string[];
  isAnonymous?: boolean;
}

export interface ReviewUpdateInput {
  reviewId: string;
  rating: number;
  content: string;
  tags?: string[];
  images?: string[];
  isAnonymous?: boolean;
}

export interface PendingReviewItem {
  order: Order;
  orderItem: OrderItem;
  productName: string;
  productImage: string | null;
  createdAt: string;
}

/** 将 Supabase 联表结果规整为前端可直接消费的评价结构。 */
function normalizeReviewRow(row: any): ReviewRecord {
  return {
    id: row.id,
    product_id: row.product_id,
    order_id: row.order_id,
    order_item_id: row.order_item_id,
    user_id: row.user_id,
    rating: row.rating,
    content: row.content ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    images: Array.isArray(row.images) ? row.images : [],
    is_anonymous: Boolean(row.is_anonymous),
    created_at: row.created_at,
    updated_at: row.updated_at,
    product: row.product
      ? {
          id: row.product.id,
          name: row.product.name,
          image_url: row.product.image_url ?? null,
          price: Number(row.product.price ?? 0),
          unit: row.product.unit,
        }
      : undefined,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name ?? "茶友",
          avatar_url: row.user.avatar_url ?? null,
        }
      : undefined,
  };
}

/** 拉取当前用户的全部评价记录。 */
export async function fetchMyReviews(userId: string): Promise<ReviewRecord[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select(REVIEW_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "加载评价失败");
  }

  return (data ?? []).map(normalizeReviewRow);
}

/** 拉取某个商品的公开评价列表，用于商品详情页展示。 */
export async function fetchProductReviews(productId: string): Promise<ReviewRecord[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select(REVIEW_SELECT)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message || "加载商品评价失败");
  }

  return (data ?? []).map(normalizeReviewRow);
}

/**
 * 从已签收订单中筛选仍未评价的订单项，生成“待评价”列表。
 * 这里会先查询订单，再排除已有评价记录的 order_item。
 */
export async function fetchPendingReviewItems(userId: string): Promise<PendingReviewItem[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*, product:products(*))")
    .eq("user_id", userId)
    .eq("status", "delivered")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message || "加载待评价订单失败");
  }

  const orders = (data ?? []) as Order[];
  const orderItemIds = orders.flatMap(
    (order) => order.order_items?.map((item) => item.id) ?? [],
  );

  if (orderItemIds.length === 0) {
    return [];
  }

  const { data: reviewRows, error: reviewError } = await supabase
    .from("product_reviews")
    .select("order_item_id")
    .in("order_item_id", orderItemIds);

  if (reviewError) {
    throw new Error(reviewError.message || "加载已评价记录失败");
  }

  const reviewedItemIds = new Set(
    (reviewRows ?? []).map((item) => item.order_item_id as string),
  );

  return orders.flatMap((order) =>
    (order.order_items ?? [])
      .filter((orderItem) => !reviewedItemIds.has(orderItem.id))
      .map((orderItem) => ({
        order,
        orderItem,
        productName: orderItem.product?.name ?? "商品",
        productImage: orderItem.product?.image_url ?? null,
        createdAt: order.created_at,
      })),
  );
}

/** 提交新的商品评价，并返回带联表信息的完整记录。 */
export async function submitReview(
  userId: string,
  input: ReviewDraftInput,
): Promise<ReviewRecord> {
  const payload = {
    product_id: input.orderItem.product_id,
    order_id: input.order.id,
    order_item_id: input.orderItem.id,
    user_id: userId,
    rating: input.rating,
    content: input.content.trim() || null,
    tags: (input.tags ?? []).filter(Boolean).slice(0, 6),
    images: (input.images ?? []).filter(Boolean).slice(0, 6),
    is_anonymous: Boolean(input.isAnonymous),
  };

  const { data, error } = await supabase
    .from("product_reviews")
    .insert(payload)
    .select(REVIEW_SELECT)
    .single();

  if (error) {
    throw new Error(error.message || "提交评价失败");
  }

  return normalizeReviewRow(data);
}

/** 更新用户自己的评价内容，并返回更新后的记录。 */
export async function updateReview(
  userId: string,
  input: ReviewUpdateInput,
): Promise<ReviewRecord> {
  const payload = {
    rating: input.rating,
    content: input.content.trim() || null,
    tags: (input.tags ?? []).filter(Boolean).slice(0, 6),
    images: (input.images ?? []).filter(Boolean).slice(0, 6),
    is_anonymous: Boolean(input.isAnonymous),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("product_reviews")
    .update(payload)
    .eq("id", input.reviewId)
    .eq("user_id", userId)
    .select(REVIEW_SELECT)
    .single();

  if (error) {
    throw new Error(error.message || "更新评价失败");
  }

  return normalizeReviewRow(data);
}

/** 删除用户自己的评价。 */
export async function deleteReview(userId: string, reviewId: string): Promise<void> {
  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "删除评价失败");
  }
}

/** 汇总评价数、均分、好评率与高频标签，供商品详情页头部概览使用。 */
export function buildReviewSummary(reviews: ReviewRecord[]) {
  if (reviews.length === 0) {
    return {
      total: 0,
      averageRating: 0,
      positiveRate: 0,
      tags: [] as { label: string; count: number }[],
    };
  }

  const totalRating = reviews.reduce((sum, item) => sum + item.rating, 0);
  const positiveCount = reviews.filter((item) => item.rating >= 4).length;
  const tagMap = new Map<string, number>();

  for (const review of reviews) {
    for (const tag of review.tags ?? []) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }

  return {
    total: reviews.length,
    averageRating: Number((totalRating / reviews.length).toFixed(1)),
    positiveRate: Math.round((positiveCount / reviews.length) * 100),
    tags: [...tagMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

/** 评价标签建议词，前台发评时作为快捷选择项。 */
export const REVIEW_TAG_SUGGESTIONS = [
  "茶香明显",
  "回甘舒服",
  "耐泡度高",
  "适合送礼",
  "新手友好",
  "包装精致",
  "口感醇厚",
  "清爽顺口",
] as const;
