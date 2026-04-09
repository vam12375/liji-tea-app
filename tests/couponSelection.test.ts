import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { reconcileSelectedUserCouponId } from "@/lib/couponSelection";

/** 用户券刷新后的选中态校验测试。 */
export async function runCouponSelectionTests() {
  console.log("[Suite] couponSelection");

  await runCase("keeps selected coupon when it is still available", () => {
    const selectedId = reconcileSelectedUserCouponId(
      [
        { id: "coupon-1", status: "available" as const },
        { id: "coupon-2", status: "used" as const },
      ],
      "coupon-1",
    );

    assert.equal(selectedId, "coupon-1");
  });

  await runCase("clears selected coupon when it is no longer available", () => {
    const selectedId = reconcileSelectedUserCouponId(
      [
        { id: "coupon-1", status: "locked" as const },
        { id: "coupon-2", status: "available" as const },
      ],
      "coupon-1",
    );

    assert.equal(selectedId, null);
  });

  await runCase("clears selection when the selected coupon disappears after refresh", () => {
    const selectedId = reconcileSelectedUserCouponId(
      [{ id: "coupon-2", status: "available" as const }],
      "coupon-1",
    );

    assert.equal(selectedId, null);
  });
}
