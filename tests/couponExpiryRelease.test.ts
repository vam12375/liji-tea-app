import assert from "node:assert/strict";

import { runCase } from "./testHarness";

function shouldSyncExpiredPendingOrder(createdAt: string, now: number) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) {
    return false;
  }

 return now - created >= 5 * 60 * 1000;
}

export async function runCouponExpiryReleaseTests() {
  console.log("[Suite] couponExpiryRelease");

  await runCase("marks 5-minute pending orders for remote expiry sync", () => {
    const now = new Date("2026-04-10T02:15:00.000Z").getTime();
    const createdAt = "2026-04-10T02:10:00.000Z";

    assert.equal(shouldSyncExpiredPendingOrder(createdAt, now), true);
  });

  await runCase("does not sync pending orders before 5 minutes", () => {
 const now = new Date("2026-04-10T02:14:59.000Z").getTime();
    const createdAt = "2026-04-10T02:10:00.000Z";

    assert.equal(shouldSyncExpiredPendingOrder(createdAt, now), false);
  });

  await runCase("ignores invalid createdAt values", () => {
       const now = new Date("2026-04-10T02:15:00.000Z").getTime();

 assert.equal(shouldSyncExpiredPendingOrder("invalid-date", now), false);
  });
}
