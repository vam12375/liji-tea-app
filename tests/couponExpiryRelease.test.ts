import assert from "node:assert/strict";

import { runCase } from "./testHarness";

function shouldSyncExpiredPendingOrder(createdAt: string, now: number) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) {
    return false;
  }

 return now - created >= 10 * 60 * 1000;
}

export async function runCouponExpiryReleaseTests() {
  console.log("[Suite] couponExpiryRelease");

  await runCase("marks 10-minute pending orders for remote expiry sync", () => {
    const now = new Date("2026-04-10T02:20:00.000Z").getTime();
    const createdAt = "2026-04-10T02:10:00.000Z";

    assert.equal(shouldSyncExpiredPendingOrder(createdAt, now), true);
  });

  await runCase("does not sync pending orders before 10 minutes", () => {
    const now = new Date("2026-04-10T02:19:59.000Z").getTime();
    const createdAt = "2026-04-10T02:10:00.000Z";

    assert.equal(shouldSyncExpiredPendingOrder(createdAt, now), false);
  });

  await runCase("ignores invalid createdAt values", () => {
    const now = new Date("2026-04-10T02:20:00.000Z").getTime();

 assert.equal(shouldSyncExpiredPendingOrder("invalid-date", now), false);
  });
}
