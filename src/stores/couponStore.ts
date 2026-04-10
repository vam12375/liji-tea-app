import { create } from "zustand";

import { createCouponStoreActions } from "@/stores/couponStore.actions";
import type { CouponState } from "@/stores/couponStore.types";

export type {
  ClaimCouponInput,
  Coupon,
  CouponState,
  FetchCouponOptions,
  UserCoupon,
  UserCouponStatus,
} from "@/stores/couponStore.types";

const initialCouponState = {
  publicCoupons: [],
  userCoupons: [],
  selectedUserCouponId: null,
  loadingPublic: false,
  loadingUser: false,
  claiming: false,
} satisfies Pick<
  CouponState,
  | "publicCoupons"
  | "userCoupons"
  | "selectedUserCouponId"
  | "loadingPublic"
  | "loadingUser"
  | "claiming"
>;

// couponStore 入口只保留公开 state 与 action 组装，内部细节全部下沉到模块。
export const useCouponStore = create<CouponState>()((set, get) => ({
  ...initialCouponState,
  ...createCouponStoreActions(set, get),
}));
