import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  registerAnalyticsHandler,
  track,
  type AnalyticsPayload,
} from "@/lib/analytics";

/**
 * analytics facade 单测：只覆盖纯逻辑（handler 分发 / 异常吞咽 / 解绑行为）。
 * 真实的队列 + AsyncStorage + Edge Function 调用在 analyticsReporter.ts，
 * 依赖 react-native + supabase，暂不在 tsx 测试中覆盖。
 */
export async function runAnalyticsTests() {
  console.log("[Suite] analytics");

  await runCase("未挂接 handler 时 track 不抛异常", () => {
    registerAnalyticsHandler(null);
    assert.doesNotThrow(() => track("payment_started", { orderId: "o-1" }));
  });

  await runCase("挂接 handler 后收到 event/properties/occurredAt 三字段", () => {
    const received: AnalyticsPayload[] = [];
    registerAnalyticsHandler((payload) => {
      received.push(payload);
    });

    track("payment_succeeded", { orderId: "o-2" });

    assert.equal(received.length, 1);
    assert.equal(received[0].event, "payment_succeeded");
    assert.deepEqual(received[0].properties, { orderId: "o-2" });
    assert.equal(typeof received[0].occurredAt, "string");
    // ISO 8601 基本形态校验：仅保证是可被 Date 解析的时间戳。
    assert.ok(!Number.isNaN(new Date(received[0].occurredAt).getTime()));

    registerAnalyticsHandler(null);
  });

  await runCase("handler 内抛错不影响调用方", () => {
    registerAnalyticsHandler(() => {
      throw new Error("boom");
    });

    assert.doesNotThrow(() => track("order_cancelled"));

    registerAnalyticsHandler(null);
  });

  await runCase("registerAnalyticsHandler(null) 解绑后再 track 不触发 handler", () => {
    let calls = 0;
    registerAnalyticsHandler(() => {
      calls += 1;
    });
    track("order_confirmed", { orderId: "o-3" });
    assert.equal(calls, 1);

    registerAnalyticsHandler(null);
    track("order_confirmed", { orderId: "o-4" });
    assert.equal(calls, 1);
  });
}
