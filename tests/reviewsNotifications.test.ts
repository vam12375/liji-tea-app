import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { routes } from "../src/lib/routes";

type ReviewRecord = {
  id: string;
  product_id: string;
  order_id: string;
  order_item_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  tags: string[];
  images: string[];
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
};

type NotificationRecord = {
  id: string;
  user_id: string;
  type: "order" | "system" | "community" | "review";
  title: string;
  message: string;
  related_type: string | null;
  related_id: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

const REVIEW_TAG_SUGGESTIONS = [
  "茶香明显",
  "回甘舒服",
  "耐泡度高",
  "适合送礼",
  "新手友好",
  "包装精致",
  "口感醇厚",
  "清爽顺口",
] as const;

/** 精简版评价汇总函数，用于验证评分、标签与好评率统计逻辑。 */
function buildReviewSummary(reviews: ReviewRecord[]) {
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
    for (const tag of review.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }

  return {
    total: reviews.length,
    averageRating: Number((totalRating / reviews.length).toFixed(1)),
    positiveRate: Math.round((positiveCount / reviews.length) * 100),
    tags: [...tagMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** 精简版通知分组函数，用于验证通知中心 Tab 分组结果。 */
function groupNotificationsByType(items: NotificationRecord[]) {
  return {
    all: items,
    order: items.filter((item) => item.type === "order"),
    system: items.filter((item) => item.type === "system"),
    community: items.filter((item) => item.type === "community"),
    review: items.filter((item) => item.type === "review"),
  };
}

/** 评价与通知模块的核心工具函数测试。 */
export async function runReviewsNotificationsTests() {
  console.log("[Suite] reviewsNotifications");

  await runCase("buildReviewSummary aggregates rating, positive rate and tags", () => {
    const summary = buildReviewSummary([
      {
        id: "r1",
        product_id: "p1",
        order_id: "o1",
        order_item_id: "oi1",
        user_id: "u1",
        rating: 5,
        content: "很好喝",
        tags: ["茶香明显", "回甘舒服"],
        images: ["https://example.com/1.jpg"],
        is_anonymous: false,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "r2",
        product_id: "p1",
        order_id: "o2",
        order_item_id: "oi2",
        user_id: "u2",
        rating: 3,
        content: "一般",
        tags: ["茶香明显"],
        images: [],
        is_anonymous: true,
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    assert.equal(summary.total, 2);
    assert.equal(summary.averageRating, 4);
    assert.equal(summary.positiveRate, 50);
    assert.deepEqual(summary.tags[0], { label: "茶香明显", count: 2 });
  });

  await runCase("review tag suggestions remain stable and non-empty", () => {
    assert.equal(REVIEW_TAG_SUGGESTIONS.length > 0, true);
    assert.equal(REVIEW_TAG_SUGGESTIONS.includes("茶香明显"), true);
  });

  await runCase("groupNotificationsByType groups records by tab type", () => {
    const records: NotificationRecord[] = [
      {
        id: "n1",
        user_id: "u1",
        type: "order",
        title: "订单通知",
        message: "订单已发货",
        related_type: "order",
        related_id: "o1",
        metadata: {},
        is_read: false,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "n2",
        user_id: "u1",
        type: "review",
        title: "评价通知",
        message: "评价成功",
        related_type: "product_review",
        related_id: "r1",
        metadata: { product_id: "p1" },
        is_read: true,
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ];

    const grouped = groupNotificationsByType(records);
    assert.equal(grouped.all.length, 2);
    assert.equal(grouped.order.length, 1);
    assert.equal(grouped.review.length, 1);
    assert.equal(grouped.system.length, 0);
  });

  await runCase("product review route carries productId and 已评价 tab", () => {
    const route = routes.productReviews("product-1");
    assert.deepEqual(route, {
      pathname: "/my-reviews",
      params: { productId: "product-1", initialTab: "已评价" },
    });
  });
}
