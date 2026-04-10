import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
 getBestAvailableUserCouponId,
  getCouponDiscountDelta,
  getCouponScopeLabel,
  reconcileSelectedUserCouponId,
} from "@/lib/couponSelection";

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
  await runCase("returns the highest discount available coupon as best coupon", () => {
    const selectedId = getBestAvailableUserCouponId(
      [
        {
          id: "coupon-1",
          status: "available" as const,
          coupon: {
            discountType: "fixed" as const,
            discountValue: 10,
            maxDiscount: null,
            scope: "all" as const,
          },
        },
        {
          id: "coupon-2",
          status: "available" as const,
 coupon: {
            discountType: "percent" as const,
            discountValue: 9,
            maxDiscount: 30,
            scope: "all" as const,
          },
        },
      ],
      {
        subtotal: 300,
        shipping: 10,
 autoDiscount: 0,
      },
    );

    assert.equal(selectedId, "coupon-2");
  });

   await runCase("prefers shipping coupon when it saves more on shipping", () => {
     const selectedId = getBestAvailableUserCouponId(
       [
         {
           id: "coupon-1",
           status: "available" as const,
           coupon: {
             discountType: "fixed" as const,
  discountValue: 6,
             maxDiscount: null,
             scope: "all" as const,
           },
         },
         {
           id: "coupon-2",
           status: "available" as const,
           coupon: {
  discountType: "fixed" as const,
             discountValue: 12,
             maxDiscount: 12,
             scope: "shipping" as const,
           },
         },
       ],
       {
         subtotal: 88,
  shipping: 10,
         autoDiscount: 0,
       },
     );
 
     assert.equal(selectedId, "coupon-2");
   });
 
   await runCase("prefers category coupon when matched category subtotal saves more", () => {
     const selectedId = getBestAvailableUserCouponId(
       [
         {
           id: "coupon-1",
           status: "available" as const,
           coupon: {
             discountType: "fixed" as const,
             discountValue: 10,
             maxDiscount: null,
             scope: "all" as const,
           },
         },
         {
           id: "coupon-2",
           status: "available" as const,
           coupon: {
             discountType: "percent" as const,
             discountValue: 8,
             maxDiscount: 30,
             scope: "category" as const,
  scopeCategoryIds: ["绿茶"],
           },
         },
       ],
       {
         subtotal: 260,
         shipping: 8,
         autoDiscount: 0,
         items: [
           { productId: "p1", category: "绿茶", quantity: 1, unitPrice: 150 },
           { productId: "p2", category: "红茶", quantity: 1, unitPrice: 110 },
         ],
       },
     );
 
     assert.equal(selectedId, "coupon-2");
   });
 
   await runCase("prefers product coupon when matched product subtotal saves more", () => {
     const selectedId = getBestAvailableUserCouponId(
       [
         {
  id: "coupon-1",
           status: "available" as const,
           coupon: {
             discountType: "fixed" as const,
             discountValue: 12,
             maxDiscount: null,
             scope: "all" as const,
           },
         },
         {
           id: "coupon-2",
           status: "available" as const,
           coupon: {
             discountType: "percent" as const,
             discountValue: 8,
  maxDiscount: 25,
             scope: "product" as const,
             scopeProductIds: ["p2"],
           },
         },
       ],
       {
         subtotal: 260,
         shipping: 8,
         autoDiscount: 0,
  items: [
           { productId: "p1", category: "绿茶", quantity: 1, unitPrice: 100 },
           { productId: "p2", category: "红茶", quantity: 1, unitPrice: 160 },
         ],
       },
     );
 
      assert.equal(selectedId, "coupon-2");
    });

  await runCase("returns savings hint when selected coupon is not the best one", () => {
    const hint = getCouponDiscountDelta(
      [
        {
          id: "coupon-1",
          status: "available" as const,
          coupon: {
            title: "满减券",
            discountType: "fixed" as const,
            discountValue: 10,
            maxDiscount: null,
            scope: "all" as const,
 },
        },
        {
          id: "coupon-2",
          status: "available" as const,
          coupon: {
            title: "精选商品8折",
            discountType: "percent" as const,
 discountValue: 8,
            maxDiscount: 25,
            scope: "product" as const,
            scopeProductIds: ["p2"],
          },
        },
      ],
      "coupon-1",
 {
        subtotal: 260,
        shipping: 8,
        autoDiscount: 0,
        items: [
          { productId: "p1", productName: "西湖龙井", category: "绿茶", quantity: 1, unitPrice: 100 },
          { productId: "p2", productName: "正山小种", category: "红茶", quantity: 1, unitPrice: 160 },
        ],
      },
    );

    assert.equal(hint?.bestUserCouponId, "coupon-2");
    assert.equal(hint?.selectedDiscountAmount, 10);
    assert.equal(hint?.bestDiscountAmount, 25);
    assert.equal(hint?.delta, 15);
  });

  await runCase("returns null when selected coupon is already the best one", () => {
    const hint = getCouponDiscountDelta(
      [
        {
          id: "coupon-1",
          status: "available" as const,
          coupon: {
            discountType: "fixed" as const,
            discountValue: 10,
            maxDiscount: null,
            scope: "all" as const,
          },
        },
      ],
      "coupon-1",
      {
        subtotal: 120,
        shipping: 8,
        autoDiscount: 0,
      },
    );

 assert.equal(hint, null);
  });

  await runCase("formats category scope label with category names", () => {
    const label = getCouponScopeLabel({
      scope: "category",
      scopeCategoryIds: ["绿茶", "红茶"],
      scopeProductIds: [],
    });

    assert.equal(label, "适用范围：绿茶、红茶");
  });

  await runCase("formats product scope label with matched product names", () => {
    const label = getCouponScopeLabel(
      {
        scope: "product",
        scopeCategoryIds: [],
        scopeProductIds: ["p1", "p2"],
      },
      [
        { productId: "p1", productName: "西湖龙井", category: "绿茶", quantity: 1, unitPrice: 100 },
        { productId: "p2", productName: "正山小种", category: "红茶", quantity: 1, unitPrice: 120 },
      ],
    );

    assert.equal(label, "适用商品：西湖龙井、正山小种");
  });
}
