import { useEffect, useMemo } from "react";

import {
  getBestAvailableUserCouponId,
  getCouponDiscountDelta,
  getCouponScopeLabel,
} from "@/lib/couponSelection";
import type { OrderPricingQuote } from "@/lib/order";
import type { UserCoupon } from "@/stores/couponStore.types";
import type { Session } from "@supabase/supabase-js";

interface CouponContextItem {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
}

interface UseCheckoutCouponParams {
  session: Session | null;
  userCoupons: UserCoupon[];
  selectedUserCouponId: string | null;
  loadingUserCoupons: boolean;
  pricing: OrderPricingQuote | null;
  couponContextItems: CouponContextItem[];
  requestItemsCount: number;
  setSelectedUserCouponId: (id: string | null) => void;
}

// 结算页优惠券编排：从页面抽离所有 useMemo 与自动选券副作用，
// 避免页面层再手工拼接派生逻辑。
export function useCheckoutCoupon({
  session,
  userCoupons,
  selectedUserCouponId,
  loadingUserCoupons,
  pricing,
  couponContextItems,
  requestItemsCount,
  setSelectedUserCouponId,
}: UseCheckoutCouponParams) {
  const selectedCoupon = useMemo(
    () => userCoupons.find((item) => item.id === selectedUserCouponId) ?? null,
    [selectedUserCouponId, userCoupons],
  );

  const availableCouponCount = useMemo(
    () => userCoupons.filter((item) => item.status === "available").length,
    [userCoupons],
  );

  const couponDescription = useMemo(() => {
    if (!session) {
      return "登录后可领取并使用优惠券";
    }

    if (selectedCoupon?.coupon) {
      const code = selectedCoupon.coupon.code?.trim();
      return code
        ? `${selectedCoupon.coupon.title} · ${code}`
        : selectedCoupon.coupon.title;
    }

    if (loadingUserCoupons) {
      return "正在加载可用优惠券...";
    }

    if (availableCouponCount > 0) {
      return `${availableCouponCount} 张可用，系统将自动为你选择最优券`;
    }

    return "暂无可用优惠券";
  }, [availableCouponCount, loadingUserCoupons, selectedCoupon, session]);

  const betterCouponHint = useMemo(
    () =>
      getCouponDiscountDelta(userCoupons, selectedUserCouponId, {
        subtotal: pricing?.subtotal ?? 0,
        shipping: pricing?.shipping ?? 0,
        autoDiscount: pricing?.autoDiscount ?? 0,
        items: couponContextItems,
      }),
    [
      couponContextItems,
      pricing?.autoDiscount,
      pricing?.shipping,
      pricing?.subtotal,
      selectedUserCouponId,
      userCoupons,
    ],
  );

  const selectedCouponScopeText = useMemo(() => {
    if (!selectedCoupon?.coupon) {
      return null;
    }

    return getCouponScopeLabel(selectedCoupon.coupon, couponContextItems);
  }, [couponContextItems, selectedCoupon]);

  const betterCouponTitle = useMemo(() => {
    if (!betterCouponHint) {
      return null;
    }

    return (
      userCoupons.find((item) => item.id === betterCouponHint.bestUserCouponId)
        ?.coupon?.title ?? null
    );
  }, [betterCouponHint, userCoupons]);

  // 用户券由根布局统一预取，这里只在数据齐备后补一次“最优券自动选择”。
  useEffect(() => {
    if (!session || loadingUserCoupons || requestItemsCount === 0) {
      return;
    }

    if (selectedUserCouponId) {
      return;
    }

    const bestCouponId = getBestAvailableUserCouponId(userCoupons, {
      subtotal: pricing?.subtotal ?? 0,
      shipping: pricing?.shipping ?? 0,
      autoDiscount: pricing?.autoDiscount ?? 0,
      items: couponContextItems,
    });

    if (bestCouponId) {
      setSelectedUserCouponId(bestCouponId);
    }
  }, [
    couponContextItems,
    loadingUserCoupons,
    pricing?.autoDiscount,
    pricing?.shipping,
    pricing?.subtotal,
    requestItemsCount,
    selectedUserCouponId,
    session,
    setSelectedUserCouponId,
    userCoupons,
  ]);

  return {
    selectedCoupon,
    availableCouponCount,
    couponDescription,
    betterCouponHint,
    selectedCouponScopeText,
    betterCouponTitle,
  };
}
