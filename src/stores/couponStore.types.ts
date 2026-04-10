// 前端优惠券基础模型，字段命名已转换成页面更容易消费的 camelCase。
export type CouponDiscountType = "fixed" | "percent";
export type CouponScope = "all" | "shipping" | "category" | "product";

export interface Coupon {
  id: string;
  title: string;
  description: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minSpend: number;
  maxDiscount: number | null;
  scope: CouponScope;
 scopeCategoryIds: string[];
  scopeProductIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

// 用户已领取的优惠券实例，会随着锁券、使用、过期而变化状态。
export interface UserCoupon {
  id: string;
  couponId: string;
  status: "available" | "locked" | "used" | "expired";
  claimedAt: string;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  usedAt: string | null;
  orderId: string | null;
  coupon: Coupon | null;
}

export type UserCouponStatus = UserCoupon["status"];

// 兼容两种领取入口：直接传优惠券 id，或通过兑换码领取。
export interface ClaimCouponInput {
  couponId?: string;
  code?: string;
}

export interface FetchCouponOptions {
  force?: boolean;
  minFreshMs?: number;
}

export interface ClaimCouponResponse {
  userCouponId: string;
}

// Store 同时管理公开优惠券、用户券列表以及结算时的选中状态。
export interface CouponState {
  publicCoupons: Coupon[];
  userCoupons: UserCoupon[];
  selectedUserCouponId: string | null;
  loadingPublic: boolean;
  loadingUser: boolean;
  claiming: boolean;
  fetchPublicCoupons: (options?: FetchCouponOptions) => Promise<void>;
  fetchUserCoupons: (options?: FetchCouponOptions) => Promise<void>;
  claimCoupon: (
    input: ClaimCouponInput,
  ) => Promise<{ error: string | null; userCouponId: string | null }>;
  setSelectedUserCouponId: (userCouponId: string | null) => void;
  clearSelectedCoupon: () => void;
  reset: () => void;
}
