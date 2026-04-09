import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  buildTrackingTimeline,
  formatDateTime,
  getDeliveryLabel,
  maskPhone,
  summarizeOrderItems,
} from "@/lib/trackingUtils";
import type { Order } from "@/types/database";

/** 订单工厂帮助测试只关注当前断言需要的字段。 */
function createOrder(overrides?: Partial<Order>): Order {
  return {
    id: "order-1",
    user_id: "user-1",
    address_id: null,
    status: "pending",
    total: 88,
    delivery_type: "standard",
    payment_method: "alipay",
    notes: null,
    gift_wrap: false,
    created_at: "2026-04-08T00:00:00.000Z",
    updated_at: "2026-04-08T00:05:00.000Z",
    ...overrides,
  };
}

/** 物流工具函数测试。 */
export async function runTrackingUtilsTests() {
  console.log("[Suite] trackingUtils");

  await runCase("formats invalid datetime as fallback text", () => {
    assert.equal(formatDateTime(undefined), "待更新");
    assert.equal(formatDateTime("invalid-date"), "待更新");
  });

  await runCase("masks phone numbers consistently", () => {
    assert.equal(maskPhone("13812345678"), "138****5678");
    assert.equal(maskPhone("12345"), "12345");
  });

  await runCase("maps delivery labels", () => {
    assert.equal(getDeliveryLabel("standard"), "标准配送");
    assert.equal(getDeliveryLabel("pickup"), "到店自提");
    assert.equal(getDeliveryLabel("custom"), "配送方式：custom");
  });

  await runCase("builds tracking timeline for shipping orders", () => {
    const timeline = buildTrackingTimeline(
      createOrder({
        status: "shipping",
        paid_at: "2026-04-08T00:01:00.000Z",
      }),
    );

    assert.equal(timeline[0]?.state, "done");
    assert.equal(timeline[2]?.state, "done");
    assert.equal(timeline[3]?.state, "current");
  });

  await runCase("summarizes order items", () => {
    const summary = summarizeOrderItems([
      {
        id: "item-1",
        order_id: "order-1",
        product_id: "product-1",
        quantity: 1,
        unit_price: 10,
        product: {
          id: "product-1",
          name: "龙井",
          origin: "杭州",
          price: 10,
          unit: "盒",
          image_url: "https://example.com/1.png",
          description: null,
          is_new: true,
          category: "绿茶",
          tagline: null,
          tasting_profile: null,
          brewing_guide: null,
          origin_story: null,
          process: null,
          stock: 10,
          is_active: true,
          created_at: "2026-04-08T00:00:00.000Z",
        },
      },
      {
        id: "item-2",
        order_id: "order-1",
        product_id: "product-2",
        quantity: 2,
        unit_price: 20,
        product: {
          id: "product-2",
          name: "岩茶",
          origin: "武夷山",
          price: 20,
          unit: "盒",
          image_url: "https://example.com/2.png",
          description: null,
          is_new: false,
          category: "乌龙茶",
          tagline: null,
          tasting_profile: null,
          brewing_guide: null,
          origin_story: null,
          process: null,
          stock: 20,
          is_active: true,
          created_at: "2026-04-08T00:00:00.000Z",
        },
      },
    ]);

    assert.equal(summary.count, 3);
    assert.equal(summary.title, "龙井、岩茶");
    assert.equal(summary.imageUrls.length, 2);
  });
}
