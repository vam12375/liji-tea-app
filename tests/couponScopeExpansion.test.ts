import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { isCouponRow, mapCoupon, type CouponRow } from "@/stores/couponStore.guards";

type CouponScopeExpansionItem = {
  productId: string;
  category: string;
  quantity: number;
  unitPrice: number;
};

function getEligibleAmount(
  row: Pick<CouponRow, "scope" | "scope_category_ids" | "scope_product_ids">,
  items: CouponScopeExpansionItem[],
  shipping: number,
  subtotal: number,
  autoDiscount: number,
) {
  if (row.scope === "shipping") {
    return Number(Math.max(shipping, 0).toFixed(2));
  }

  if (row.scope === "category") {
    const hit = new Set(row.scope_category_ids ?? []);
    return Number(
      Math.max(
        items
          .filter((item) => hit.has(item.category))
          .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        0,
      ).toFixed(2),
    );
  }

  if (row.scope === "product") {
    const hit = new Set(row.scope_product_ids ?? []);
    return Number(
      Math.max(
        items
          .filter((item) => hit.has(item.productId))
          .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        0,
      ).toFixed(2),
    );
  }

  return Number(Math.max(subtotal - autoDiscount, 0).toFixed(2));
}

export async function runCouponScopeExpansionTests() {
  console.log("[Suite] couponScopeExpansion");

  await runCase("maps category scope coupon with category targets", () => {
    const row: CouponRow = {
      id: "coupon-category",
      title: "绿茶品类满199减25",
      description: "测试券",
      code: "GREEN199MINUS25",
 scope: "category",
      scope_category_ids: ["绿茶"],
      scope_product_ids: [],
      discount_type: "fixed",
      discount_value: 25,
      min_spend: 199,
      max_discount: null,
 starts_at: null,
      ends_at: null,
      is_active: true,
    };

    assert.equal(isCouponRow(row), true);
    const mapped = mapCoupon(row);
    assert.equal(mapped.scope, "category");
    assert.deepEqual(mapped.scopeCategoryIds, ["绿茶"]);
  });

  await runCase("maps product scope coupon with product targets", () => {
    const row: CouponRow = {
      id: "coupon-product",
      title: "指定商品9折券",
      description: "测试券",
      code: "SKU90OFF",
      scope: "product",
      scope_category_ids: [],
      scope_product_ids: ["product-1", "product-2"],
      discount_type: "percent",
      discount_value: 9,
      min_spend: 99,
      max_discount: 20,
      starts_at: null,
      ends_at: null,
      is_active: true,
    };

    assert.equal(isCouponRow(row), true);
    const mapped = mapCoupon(row);
    assert.equal(mapped.scope, "product");
    assert.deepEqual(mapped.scopeProductIds, ["product-1", "product-2"]);
  });

  await runCase("category scope only counts matched category subtotal", () => {
    const eligibleAmount = getEligibleAmount(
      {
        scope: "category",
        scope_category_ids: ["绿茶"],
        scope_product_ids: [],
 },
      [
        { productId: "p1", category: "绿茶", quantity: 2, unitPrice: 100 },
        { productId: "p2", category: "红茶", quantity: 1, unitPrice: 120 },
      ],
      15,
      320,
      50,
    );

    assert.equal(eligibleAmount, 200);
  });

  await runCase("product scope only counts matched product subtotal", () => {
    const eligibleAmount = getEligibleAmount(
      {
        scope: "product",
        scope_category_ids: [],
        scope_product_ids: ["p2"],
      },
      [
        { productId: "p1", category: "绿茶", quantity: 2, unitPrice: 100 },
 { productId: "p2", category: "红茶", quantity: 1, unitPrice: 120 },
      ],
      15,
      320,
50,
    );

 assert.equal(eligibleAmount, 120);
  });
}
