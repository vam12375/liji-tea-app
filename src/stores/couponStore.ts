import { supabase } from "@/lib/supabase";
import { create } from "zustand";

// 前端优惠券基础模型，字段命名已转换成页面更容易消费的 camelCase。
export interface Coupon {
  id: string;
  title: string;
  description: string;
  code: string;
  discountType: string;
  discountValue: number;
  minSpend: number;
  maxDiscount: number | null;
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

// 兼容两种领取入口：直接传优惠券 id，或通过兑换码领取。
interface ClaimCouponInput {
  couponId?: string;
  code?: string;
}

// Store 同时管理公开优惠券、用户券列表以及结算时的选中状态。
interface CouponState {
  publicCoupons: Coupon[];
  userCoupons: UserCoupon[];
  selectedUserCouponId: string | null;
  loadingPublic: boolean;
  loadingUser: boolean;
  claiming: boolean;
  fetchPublicCoupons: () => Promise<void>;
  fetchUserCoupons: () => Promise<void>;
  claimCoupon: (
    input: ClaimCouponInput,
  ) => Promise<{ error: string | null; userCouponId: string | null }>;
  setSelectedUserCouponId: (userCouponId: string | null) => void;
  clearSelectedCoupon: () => void;
  reset: () => void;
}

// 兼容 Supabase numeric / text 返回值，统一转成 number 便于前端展示。
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

// 将 coupons 表记录映射成前端直接可用的优惠券对象。
function mapCoupon(row: any): Coupon {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    code: row.code,
    discountType: row.discount_type,
    discountValue: toNumber(row.discount_value),
    minSpend: toNumber(row.min_spend),
    maxDiscount: row.max_discount === null ? null : toNumber(row.max_discount),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    isActive: row.is_active === true,
  };
}

// 将 user_coupons 联表结果映射成结算页使用的用户优惠券结构。
function mapUserCoupon(row: any): UserCoupon {
  return {
    id: row.id,
    couponId: row.coupon_id,
    status: row.status,
    claimedAt: row.claimed_at,
    lockedAt: row.locked_at ?? null,
    lockExpiresAt: row.lock_expires_at ?? null,
    usedAt: row.used_at ?? null,
    orderId: row.order_id ?? null,
    coupon: row.coupon ? mapCoupon(row.coupon) : null,
  };
}

// 统一读取当前登录用户 id，避免每个 action 重复拆 session。
async function getSessionUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

// 优先提取 Edge Function 返回的 message，保证用户提示更准确。
async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "context" in error) {
    try {
      const response = (error as { context: Response }).context;
      const body = await response.json();
      if (body?.message) {
        return body.message as string;
      }
    } catch {
      // ignore
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

// 优惠券中心与结算页共用同一个 store，避免公开券和用户券状态分散。
export const useCouponStore = create<CouponState>()((set, get) => ({
  publicCoupons: [],
  userCoupons: [],
  selectedUserCouponId: null,
  loadingPublic: false,
  loadingUser: false,
  claiming: false,

  // 拉取可领取的公开优惠券列表，主要供优惠券中心展示。
  fetchPublicCoupons: async () => {
    try {
      set({ loadingPublic: true });
      const { data, error } = await supabase
        .from("coupons")
        .select(
          "id, title, description, code, discount_type, discount_value, min_spend, max_discount, starts_at, ends_at, is_active",
        )
        .order("ends_at", { ascending: true });

      if (error) {
        throw error;
      }

      set({
        publicCoupons: (data ?? []).map(mapCoupon),
        loadingPublic: false,
      });
    } catch (error) {
      console.warn("[couponStore] fetchPublicCoupons 失败:", error);
      set({ loadingPublic: false });
    }
  },

  // 拉取当前用户已领取的优惠券，并校验当前选中的券是否仍然可用。
  fetchUserCoupons: async () => {
    try {
      const userId = await getSessionUserId();
      if (!userId) {
        set({ userCoupons: [], selectedUserCouponId: null, loadingUser: false });
        return;
      }

      set({ loadingUser: true });
      const { data, error } = await supabase
        .from("user_coupons")
        .select(
          "id, coupon_id, status, claimed_at, locked_at, lock_expires_at, used_at, order_id, coupon:coupons(id, title, description, code, discount_type, discount_value, min_spend, max_discount, starts_at, ends_at, is_active)",
        )
        .eq("user_id", userId)
        .order("claimed_at", { ascending: false });

      if (error) {
        throw error;
      }

      const userCoupons = (data ?? []).map(mapUserCoupon);
      const currentSelectedId = get().selectedUserCouponId;
      const selectedStillAvailable = userCoupons.some(
        (item) => item.id === currentSelectedId && item.status === "available",
      );

      set({
        userCoupons,
        selectedUserCouponId: selectedStillAvailable ? currentSelectedId : null,
        loadingUser: false,
      });
    } catch (error) {
      console.warn("[couponStore] fetchUserCoupons 失败:", error);
      set({ loadingUser: false });
    }
  },

  // 统一封装领取入口，成功后同步刷新公开券和用户券列表。
  claimCoupon: async (input) => {
    try {
      set({ claiming: true });
      const { data, error } = await supabase.functions.invoke<{
        userCouponId: string;
      }>("claim-coupon", {
        body: {
          couponId: input.couponId,
          code: input.code,
        },
      });

      if (error) {
        return {
          error: await getFunctionErrorMessage(error, "领取优惠券失败。"),
          userCouponId: null,
        };
      }

      await Promise.all([get().fetchPublicCoupons(), get().fetchUserCoupons()]);

      return {
        error: null,
        userCouponId: data?.userCouponId ?? null,
      };
    } catch (error) {
      console.warn("[couponStore] claimCoupon 失败:", error);
      return {
        error: error instanceof Error ? error.message : "领取优惠券失败。",
        userCouponId: null,
      };
    } finally {
      set({ claiming: false });
    }
  },

  // 结算页只记录当前选择的 user_coupon id，真正校验仍交给服务端。
  setSelectedUserCouponId: (userCouponId) => {
    set({ selectedUserCouponId: userCouponId });
  },

  // 下单成功、退出结算页或切换账号时清空当前选券。
  clearSelectedCoupon: () => {
    set({ selectedUserCouponId: null });
  },

  // 退出登录后重置整块优惠券状态，避免旧账号数据残留。
  reset: () => {
    set({
      publicCoupons: [],
      userCoupons: [],
      selectedUserCouponId: null,
      loadingPublic: false,
      loadingUser: false,
      claiming: false,
    });
  },
}));
