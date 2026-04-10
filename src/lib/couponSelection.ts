interface AvailableUserCouponLike {
  id: string;
  status: "available" | "locked" | "used" | "expired";
}

interface CouponDiscountLike {
  title?: string;
  code?: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  maxDiscount: number | null;
  scope?: "all" | "shipping" | "category" | "product";
  scopeCategoryIds?: string[];
  scopeProductIds?: string[];
}

interface CouponItemLike {
  productId: string;
  productName?: string;
  category: string;
  quantity: number;
 unitPrice: number;
}

interface CouponPricingLike {
  id: string;
  status: "available" | "locked" | "used" | "expired";
  coupon?: CouponDiscountLike | null;
}

interface BestCouponContext {
  subtotal: number;
  shipping: number;
  autoDiscount: number;
  items?: CouponItemLike[];
}

export interface CouponRecommendation<TCouponId extends string = string> {
  userCouponId: TCouponId;
  discountAmount: number;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function getEligibleAmount(
  coupon: CouponDiscountLike,
  context: BestCouponContext,
) {
  if (coupon.scope === "shipping") {
    return roundCurrency(Math.max(context.shipping, 0));
  }

  if (coupon.scope === "category") {
    const hit = new Set(coupon.scopeCategoryIds ?? []);
    const amount = (context.items ?? [])
      .filter((item) => hit.has(item.category))
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return roundCurrency(Math.max(amount, 0));
  }

  if (coupon.scope === "product") {
    const hit = new Set(coupon.scopeProductIds ?? []);
    const amount = (context.items ?? [])
      .filter((item) => hit.has(item.productId))
      .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return roundCurrency(Math.max(amount, 0));
  }

  return roundCurrency(Math.max(context.subtotal - context.autoDiscount, 0));
}

function getCouponDiscountAmount(
  coupon: CouponDiscountLike,
  context: BestCouponContext,
) {
  const eligibleAmount = getEligibleAmount(coupon, context);
  if (eligibleAmount <= 0) {
    return 0;
  }

  let discountAmount = 0;
  if (coupon.discountType === "fixed") {
    discountAmount = coupon.discountValue;
  } else {
    const normalizedDiscountRate =
      coupon.discountValue <= 1 ? coupon.discountValue : coupon.discountValue / 10;
    discountAmount = roundCurrency(
      eligibleAmount - eligibleAmount * (normalizedDiscountRate / 10),
    );
  }

  if (coupon.maxDiscount !== null) {
    discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  }

  return roundCurrency(Math.min(discountAmount, eligibleAmount));
}

export function getCouponScopeLabel(
  coupon: Pick<CouponDiscountLike, "scope" | "scopeCategoryIds" | "scopeProductIds">,
  items: readonly CouponItemLike[] = [],
) {
  if (coupon.scope === "shipping") {
    return "适用范围：运费券";
 }

  if (coupon.scope === "category") {
    const categories = (coupon.scopeCategoryIds ?? []).filter(Boolean);
    return categories.length > 0
      ? `适用范围：${categories.join("、")}`
      : "适用范围：分类券";
  }

  if (coupon.scope === "product") {
    const productIds = (coupon.scopeProductIds ?? []).filter(Boolean);
    const productNames = productIds
      .map((productId) => items.find((item) => item.productId === productId)?.productName)
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0);

    if (productNames.length > 0) {
      return `适用商品：${productNames.join("、")}`;
    }

    return productIds.length > 0
      ? `适用商品：指定商品（${productIds.length} 件）`
 : "适用商品：指定商品";
  }

  return "适用范围：全场通用";
}

// 刷新用户券后重新校验当前选中项，避免结算页继续持有已失效或已锁定的券。
export function reconcileSelectedUserCouponId<T extends AvailableUserCouponLike>(
  userCoupons: readonly T[],
  selectedUserCouponId: string | null,
): string | null {
  if (!selectedUserCouponId) {
    return null;
  }

  const selectedStillAvailable = userCoupons.some(
    (item) => item.id === selectedUserCouponId && item.status === "available",
  );

  return selectedStillAvailable ? selectedUserCouponId : null;
}

export function getBestAvailableUserCouponId<T extends CouponPricingLike>(
  userCoupons: readonly T[],
  context: BestCouponContext,
): string | null {
  return getBestCouponRecommendation(userCoupons, context)?.userCouponId ?? null;
}

export function getBestCouponRecommendation<T extends CouponPricingLike>(
  userCoupons: readonly T[],
  context: BestCouponContext,
): CouponRecommendation<T["id"]> | null {
  let bestRecommendation: CouponRecommendation<T["id"]> | null = null;

  for (const userCoupon of userCoupons) {
    if (userCoupon.status !== "available" || !userCoupon.coupon) {
      continue;
    }

    const discountAmount = getCouponDiscountAmount(userCoupon.coupon, context);
 if (!bestRecommendation || discountAmount > bestRecommendation.discountAmount) {
      bestRecommendation = {
        userCouponId: userCoupon.id,
        discountAmount,
      };
    }
  }

  return bestRecommendation;
}

export function getCouponDiscountDelta<T extends CouponPricingLike>(
  userCoupons: readonly T[],
  selectedUserCouponId: string | null,
  context: BestCouponContext,
) {
  const bestRecommendation = getBestCouponRecommendation(userCoupons, context);
  if (!bestRecommendation) {
    return null;
  }

  const selectedCoupon = userCoupons.find(
    (item) => item.id === selectedUserCouponId && item.status === "available" && item.coupon,
 );
  const selectedDiscountAmount = selectedCoupon?.coupon
    ? getCouponDiscountAmount(selectedCoupon.coupon, context)
    : 0;

  if (bestRecommendation.userCouponId === selectedUserCouponId) {
    return null;
  }

  const delta = roundCurrency(bestRecommendation.discountAmount - selectedDiscountAmount);
  if (delta <= 0) {
    return null;
  }

  return {
    bestUserCouponId: bestRecommendation.userCouponId,
    bestDiscountAmount: bestRecommendation.discountAmount,
    selectedDiscountAmount,
    delta,
  };
}
