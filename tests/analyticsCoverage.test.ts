import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  registerAnalyticsHandler,
  track,
  type AnalyticsEvent,
  type AnalyticsPayload,
} from "@/lib/analytics";

/**
 * 核心漏斗埋点白名单覆盖：保证 v4.4.0 新增的 15 类事件都在白名单内，
 * 且 track() 分发路径与原有 10 类保持一致（event / properties / occurredAt 三字段齐全）。
 *
 * 为什么不直接在真实业务代码里单测：
 * - cartStore / couponStore / checkout 钩子依赖 react-native，tsx 运行时不支持；
 * - 本测试只守护"白名单 + 分发"层，防止后续重构误删事件名或 payload 字段。
 */

const NEW_DISCOVERY_EVENTS: AnalyticsEvent[] = [
  "home_impression",
  "product_impression",
  "product_view",
  "article_view",
  "search_submit",
];

const NEW_FUNNEL_EVENTS: AnalyticsEvent[] = [
  "add_to_cart",
  "checkout_start",
  "coupon_apply",
  "order_submit",
];

const NEW_RETENTION_EVENTS: AnalyticsEvent[] = [
  "login_success",
  "register_success",
  "favorite_added",
  "coupon_claim",
];

const NEW_CONTENT_EVENTS: AnalyticsEvent[] = [
  "post_publish",
  "share_triggered",
];

export async function runAnalyticsCoverageTests() {
  console.log("[Suite] analyticsCoverage");

  await runCase("新增 15 类事件均可通过 track() 分发", () => {
    const received: AnalyticsPayload[] = [];
    registerAnalyticsHandler((payload) => {
      received.push(payload);
    });

    const allNew = [
      ...NEW_DISCOVERY_EVENTS,
      ...NEW_FUNNEL_EVENTS,
      ...NEW_RETENTION_EVENTS,
      ...NEW_CONTENT_EVENTS,
    ];

    assert.equal(allNew.length, 15, "本轮扩容的新事件总数应为 15");

    for (const event of allNew) {
      track(event, { _test: true });
    }

    registerAnalyticsHandler(null);

    assert.equal(received.length, allNew.length);
    for (let i = 0; i < allNew.length; i += 1) {
      assert.equal(received[i].event, allNew[i]);
      assert.deepEqual(received[i].properties, { _test: true });
      assert.equal(typeof received[i].occurredAt, "string");
    }
  });

  await runCase("漏斗事件（checkout_start / order_submit）载荷支持数值字段", () => {
    const received: AnalyticsPayload[] = [];
    registerAnalyticsHandler((payload) => {
      received.push(payload);
    });

    track("checkout_start", { itemsCount: 3, total: 128.5 });
    track("order_submit", { orderId: "o-1", total: 128.5 });

    registerAnalyticsHandler(null);

    assert.equal(received.length, 2);
    assert.deepEqual(received[0].properties, { itemsCount: 3, total: 128.5 });
    assert.deepEqual(received[1].properties, { orderId: "o-1", total: 128.5 });
  });

  await runCase("登录 / 注册事件支持 method 字段（email / one-click）", () => {
    const received: AnalyticsPayload[] = [];
    registerAnalyticsHandler((payload) => {
      received.push(payload);
    });

    track("login_success", { method: "email" });
    track("login_success", { method: "one-click" });
    track("register_success", { method: "email" });

    registerAnalyticsHandler(null);

    assert.equal(received.length, 3);
    assert.equal((received[0].properties as { method?: string }).method, "email");
    assert.equal((received[1].properties as { method?: string }).method, "one-click");
    assert.equal((received[2].properties as { method?: string }).method, "email");
  });
}
