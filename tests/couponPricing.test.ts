import assert from "node:assert/strict";

import { runCase } from "./testHarness";

type CouponScope = "all" | "shipping";
type CouponDiscountType = "fixed" | "percent";

interface CouponLike {
  code: string;
 discountType: CouponDiscountType;
  discountValue: number;
  minSpend: number;
  maxDiscount: number | null;
}

interface PricingContextLike {
  subtotal: number;
  shipping: number;
 autoDiscount: number;
}

function resolveCouponScope(code: string): CouponScope {
  const normalizedCode = code.trim().toUpperCase();
  return normalizedCode.includes("SHIP") || normalizedCode.includes("FREIGHT")
    ? "shipping"
    : "all";
}

function getEligibleAmount(scope: CouponScope, context: PricingContextLike) {
  if (scope === "shipping") {
    return Math.max(Number(context.shipping.toFixed(2)), 0);
  }

  return Math.max(Number((context.subtotal - context.autoDiscount).toFixed(2)), 0);
}

function calculateDiscount(coupon: CouponLike, context: PricingContextLike) {
  const scope = resolveCouponScope(coupon.code);
  const eligibleAmount = getEligibleAmount(scope, context);

  if (context.subtotal < coupon.minSpend || eligibleAmount <= 0) {
    return { scope, eligibleAmount, discountAmount: 0 };
  }

 let discountAmount = 0;
  if (coupon.discountType === "fixed") {
    discountAmount = coupon.discountValue;
  } else {
    const normalizedDiscountRate = coupon.discountValue <= 1
 ? coupon.discountValue
      : coupon.discountValue / 10;
    discountAmount = Number(
      (eligibleAmount - eligibleAmount * (normalizedDiscountRate / 10)).toFixed(2),
    );
  }

  if (coupon.maxDiscount !== null) {
    discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  }

  return {
    scope,
    eligibleAmount,
 discountAmount: Number(Math.min(discountAmount, eligibleAmount).toFixed(2)),
  };
}

export async function runCouponPricingTests() {
  console.log("[Suite] couponPricing");

  await runCase("caps percent coupon discount by maxDiscount", () => {
    const result = calculateDiscount(
      {
        code: "TEA90OFF",
        discountType: "percent",
        discountValue: 9,
 minSpend: 128,
        maxDiscount: 30,
      },
      {
        subtotal: 500,
        shipping:15,
        autoDiscount: 50,
      },
    );

    assert.equal(result.scope, "all");
    assert.equal(result.eligibleAmount, 450);
    assert.equal(result.discountAmount, 30);
  });

 await runCase("shipping coupon only discounts shipping amount", () => {
    const result = calculateDiscount(
      {
        code: "SHIP12",
 discountType: "fixed",
        discountValue: 12,
        minSpend: 0,
        maxDiscount: null,
      },
      {
        subtotal: 88,
        shipping: 10,
 autoDiscount: 0,
      },
    );

    assert.equal(result.scope, "shipping");
    assert.equal(result.eligibleAmount, 10);
    assert.equal(result.discountAmount, 10);
 });

  await runCase("percent coupon uses subtotal after auto discount as eligible amount", () => {
    const result = calculateDiscount(
      {
        code: "TEA80OFF",
 discountType: "percent",
        discountValue: 8,
 minSpend: 188,
        maxDiscount: 60,
      },
      {
        subtotal: 260,
        shipping:0,
        autoDiscount: 50,
      },
    );

    assert.equal(result.scope, "all");
 assert.equal(result.eligibleAmount, 210);
    assert.equal(result.discountAmount, 60);
  });
}
