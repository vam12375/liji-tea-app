import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  PENDING_ORDER_EXPIRE_MS,
  formatRemainingPaymentTime,
  getPendingPaymentDeadline,
  isPendingOrderExpired,
} from "@/lib/orderTiming";

/** 订单支付时效规则测试。 */
export async function runOrderTimingTests() {
  console.log("[Suite] orderTiming");

  await runCase("calculates payment deadline from createdAt", () => {
    const deadline = getPendingPaymentDeadline("2026-04-08T00:00:00.000Z");
    assert.equal(
      deadline,
      Date.parse("2026-04-08T00:00:00.000Z") + PENDING_ORDER_EXPIRE_MS,
    );
  });

  await runCase("formats remaining time as mm:ss", () => {
    assert.equal(formatRemainingPaymentTime(65_000), "01:05");
    assert.equal(formatRemainingPaymentTime(1_000), "00:01");
  });

  await runCase("marks only expired pending orders as expired", () => {
    const originalNow = Date.now;
    Date.now = () => Date.parse("2026-04-08T00:11:00.000Z");

    try {
      assert.equal(
        isPendingOrderExpired({
          status: "pending",
          created_at: "2026-04-08T00:00:00.000Z",
        }),
        true,
      );
      assert.equal(
        isPendingOrderExpired({
          status: "paid",
          created_at: "2026-04-08T00:00:00.000Z",
        }),
        false,
      );
    } finally {
      Date.now = originalNow;
    }
  });
}
