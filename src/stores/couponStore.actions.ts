import { fetchPaymentOrderStatus } from "@/lib/alipay";
import { logWarn } from "@/lib/logger";
import { track } from "@/lib/analytics";
import { reconcileSelectedUserCouponId } from "@/lib/couponSelection";
import { supabase } from "@/lib/supabase";
import { invokeSupabaseFunctionStrict } from "@/lib/supabaseFunction";
import {
  COUPON_CACHE_TTL_MS,
  couponRequestCache,
  isCouponCacheFresh,
  resetCouponRequestCache,
} from "@/stores/couponStore.cache";
import {
  isClaimCouponResponse,
  isCouponRow,
  isUserCouponRow,
  mapCoupon,
  mapUserCoupon,
  type UserCouponRow,
} from "@/stores/couponStore.guards";
import type {
  ClaimCouponResponse,
  CouponState,
} from "@/stores/couponStore.types";

type CouponStoreSet = (
  partial: Partial<CouponState> | ((state: CouponState) => Partial<CouponState>),
) => void;
type CouponStoreGet = () => CouponState;

// 统一读取当前登录用户 id，避免每个 action 重复拆 session。
async function getSessionUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function syncExpiredLockedCouponsForUser(userId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !Array.isArray(data) || data.length === 0) {
    return;
  }

  const now = Date.now();
 const expiredPendingOrders = data.filter((item) => {
    if (typeof item.id !== "string" || typeof item.created_at !== "string") {
      return false;
    }

 const createdAt = new Date(item.created_at).getTime();
    return Number.isFinite(createdAt) && now - createdAt >= 5 *60 * 1000;
  });

 await Promise.allSettled(
    expiredPendingOrders.map((order) => fetchPaymentOrderStatus(order.id)),
  );
}

// 将 fetch / claim / reset 逻辑集中在这里，store 入口只保留状态与组装。
export function createCouponStoreActions(
  set: CouponStoreSet,
  get: CouponStoreGet,
): Omit<CouponState, "publicCoupons" | "userCoupons" | "selectedUserCouponId" | "loadingPublic" | "loadingUser" | "claiming"> {
  return {
    fetchPublicCoupons: async (options) => {
      const force = options?.force === true;
      const minFreshMs = options?.minFreshMs ?? COUPON_CACHE_TTL_MS;

      if (
        !force &&
        get().publicCoupons.length > 0 &&
        isCouponCacheFresh(couponRequestCache.publicCouponsFetchedAt, minFreshMs)
      ) {
        return;
      }

      if (!force && couponRequestCache.publicCouponsInFlight) {
        return couponRequestCache.publicCouponsInFlight;
      }

      const requestId = ++couponRequestCache.publicCouponsRequestId;
      const request = (async () => {
        try {
          set({ loadingPublic: true });
          const { data, error } = await supabase
            .from("coupons")
            .select(
              "id, title, description, code, scope, scope_category_ids, scope_product_ids, discount_type, discount_value, min_spend, max_discount, starts_at, ends_at, is_active",
            )
            .order("ends_at", { ascending: true })
            .limit(50);

          if (error) {
            throw error;
          }

          const publicCoupons = Array.isArray(data)
            ? data.filter(isCouponRow).map(mapCoupon)
            : [];

          if (requestId !== couponRequestCache.publicCouponsRequestId) {
            return;
          }

          couponRequestCache.publicCouponsFetchedAt = Date.now();
          set({ publicCoupons, loadingPublic: false });
        } catch (error) {
          logWarn("couponStore", "fetchPublicCoupons 失败", {
            error: error instanceof Error ? error.message : String(error),
          });

          if (requestId === couponRequestCache.publicCouponsRequestId) {
            set({ loadingPublic: false });
          }
        } finally {
          if (requestId === couponRequestCache.publicCouponsRequestId) {
            couponRequestCache.publicCouponsInFlight = null;
          }
        }
      })();

      couponRequestCache.publicCouponsInFlight = request;
      return request;
    },

    fetchUserCoupons: async (options) => {
      const force = options?.force === true;
      const minFreshMs = options?.minFreshMs ?? COUPON_CACHE_TTL_MS;
      const userId = await getSessionUserId();

      if (!userId) {
        couponRequestCache.userCouponsFetchedAt = 0;
        couponRequestCache.lastFetchedUserCouponsUserId = null;
        couponRequestCache.userCouponsInFlightUserId = null;
        set({ userCoupons: [], selectedUserCouponId: null, loadingUser: false });
        return;
      }

      if (
        !force &&
        couponRequestCache.lastFetchedUserCouponsUserId === userId &&
        get().userCoupons.length > 0 &&
        isCouponCacheFresh(couponRequestCache.userCouponsFetchedAt, minFreshMs)
      ) {
        return;
      }

      if (
        !force &&
        couponRequestCache.userCouponsInFlight &&
        couponRequestCache.userCouponsInFlightUserId === userId
      ) {
        return couponRequestCache.userCouponsInFlight;
      }

      const requestId = ++couponRequestCache.userCouponsRequestId;
      const request = (async () => {
        try {
          set({ loadingUser: true });
          await syncExpiredLockedCouponsForUser(userId);
          const { data, error } = await supabase
            .from("user_coupons")
            .select(
              "id, coupon_id, status, claimed_at, locked_at, lock_expires_at, used_at, order_id, coupon:coupons(id, title, description, code, scope, scope_category_ids, scope_product_ids, discount_type, discount_value, min_spend, max_discount, starts_at, ends_at, is_active)",
            )
            .eq("user_id", userId)
            .order("claimed_at", { ascending: false })
            .limit(50);

          if (error) {
            throw error;
          }

          const userCoupons = Array.isArray(data)
            ? data.filter(isUserCouponRow).map((row) => mapUserCoupon(row as UserCouponRow))
            : [];
          const currentSelectedId = get().selectedUserCouponId;

          if (requestId !== couponRequestCache.userCouponsRequestId) {
            return;
          }

          couponRequestCache.userCouponsFetchedAt = Date.now();
          couponRequestCache.lastFetchedUserCouponsUserId = userId;
          set({
            userCoupons,
            selectedUserCouponId: reconcileSelectedUserCouponId(
              userCoupons,
              currentSelectedId,
            ),
            loadingUser: false,
          });
        } catch (error) {
          logWarn("couponStore", "fetchUserCoupons 失败", {
            error: error instanceof Error ? error.message : String(error),
          });

          if (requestId === couponRequestCache.userCouponsRequestId) {
            set({ loadingUser: false });
          }
        } finally {
          if (requestId === couponRequestCache.userCouponsRequestId) {
            couponRequestCache.userCouponsInFlight = null;
            couponRequestCache.userCouponsInFlightUserId = null;
          }
        }
      })();

      couponRequestCache.userCouponsInFlight = request;
      couponRequestCache.userCouponsInFlightUserId = userId;
      return request;
    },

    claimCoupon: async (input) => {
      try {
        set({ claiming: true });
        const data = await invokeSupabaseFunctionStrict<ClaimCouponResponse>(
          "claim-coupon",
          {
            authMode: "session",
            body: {
              couponId: input.couponId,
              code: input.code,
            },
            fallbackMessage: "领取优惠券失败。",
            validate: isClaimCouponResponse,
            invalidDataMessage: "领取优惠券失败，服务端返回数据格式不正确。",
          },
        );

        await Promise.all([
          get().fetchPublicCoupons({ force: true }),
          get().fetchUserCoupons({ force: true }),
        ]);

        // 领券成功埋点：同时记录 userCouponId 便于和 claim 结果关联（couponId 在 input 里可能为空）。
        track("coupon_claim", {
          userCouponId: data.userCouponId,
          byCode: Boolean(input.code),
        });

        return {
          error: null,
          userCouponId: data.userCouponId,
        };
      } catch (error) {
        logWarn("couponStore", "claimCoupon 失败", {
          error: error instanceof Error ? error.message : String(error),
        });
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
      resetCouponRequestCache();
      set({
        publicCoupons: [],
        userCoupons: [],
        selectedUserCouponId: null,
        loadingPublic: false,
        loadingUser: false,
        claiming: false,
      });
    },
  };
}
