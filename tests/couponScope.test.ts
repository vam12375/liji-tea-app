import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { isCouponRow, mapCoupon, type CouponRow } from "@/stores/couponStore.guards";

export async function runCouponScopeTests() {
  console.log("[Suite] couponScope");

  await runCase("accepts coupon row with explicit all scope", () => {
     const row: CouponRow = {
       id: "coupon-1",
       title: "全场9折",
       description: "测试券",
       code: "TEA90OFF",
       scope: "all",
       discount_type: "percent",
       discount_value: 9,
       min_spend: 128,
       max_discount: 30,
       starts_at: null,
  ends_at: null,
       is_active: true,
     };

    assert.equal(isCouponRow(row), true);
 assert.equal(mapCoupon(row).scope, "all");
  });

  await runCase("accepts coupon row with explicit shipping scope", () => {
 const row: CouponRow = {
      id: "coupon-2",
      title: "运费立减券",
      description: "测试券",
      code: "SHIP12",
      scope: "shipping",
      discount_type: "fixed",
      discount_value: 12,
 min_spend: 0,
      max_discount: 12,
      starts_at: null,
      ends_at: null,
      is_active: true,
    };

    assert.equal(isCouponRow(row), true);
 assert.equal(mapCoupon(row).scope, "shipping");
  });

  await runCase("rejects coupon row when scope is missing", () => {
    const row = {
      id: "coupon-3",
      title: "缺少范围券",
      description: "测试券",
      code: "BAD",
      discount_type: "fixed",
      discount_value: 5,
      min_spend: 0,
 max_discount: null,
      starts_at: null,
      ends_at: null,
      is_active: true,
    };

 assert.equal(isCouponRow(row), false);
  });
}
