import { logWarn } from "@/lib/logger";
import { reconcileSelectedUserCouponId } from "@/lib/couponSelection";
import { supabase } from "@/lib/supabase";
import { invokeSupabaseFunctionStrict } from "@/lib/supabaseFunction";
import { create } from "zustand";

const COUPON_CACHE_TTL_MS = 30_000;

let publicCouponsFetchedAt = 0;
let userCouponsFetchedAt = 0;
let lastFetchedUserCouponsUserId: string | null = null;
let publicCouponsInFlight: Promise<void> | null = null;
let userCouponsInFlight: Promise<void> | null = null;
let userCouponsInFlightUserId: string | null = null;
let publicCouponsRequestId = 0;
let userCouponsRequestId = 0;

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

type UserCouponStatus = UserCoupon["status"];

// 兼容两种领取入口：直接传优惠券 id，或通过兑换码领取。
interface ClaimCouponInput {
  couponId?: string;
  code?: string;
}

interface FetchCouponOptions {
  force?: boolean;
  minFreshMs?: number;
}

// Store 同时管理公开优惠券、用户券列表以及结算时的选中状态。
interface CouponState {
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

type CouponRow = {
  id: string;
  title: string;
  description: string | null;
  code: string;
  discount_type: string;
  discount_value: number | string | null;
  min_spend: number | string | null;
  max_discount: number | string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
};

type UserCouponRow = {
  id: string;
  coupon_id: string;
  status: UserCouponStatus;
  claimed_at: string;
  locked_at?: string | null;
  lock_expires_at?: string | null;
  used_at?: string | null;
  order_id?: string | null;
  coupon?: CouponRow | CouponRow[] | null;
};

interface ClaimCouponResponse {
  userCouponId: string;
}

// 兼容 Supabase numeric / text 返回值，统一转成 number 便于前端展示。
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown) {
  return typeof value === "string" || value === null || value === undefined;
}

function getRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isUserCouponStatus(value: unknown): value is UserCouponStatus {
  return (
    value === "available" ||
    value === "locked" ||
    value === "used" ||
    value === "expired"
  );
}

function isCouponRow(value: unknown): value is CouponRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isNullableString(value.description) &&
    typeof value.code === "string" &&
    typeof value.discount_type === "string" &&
    (typeof value.discount_value === "number" ||
      typeof value.discount_value === "string" ||
      value.discount_value === null) &&
    (typeof value.min_spend === "number" ||
      typeof value.min_spend === "string" ||
      value.min_spend === null) &&
    (typeof value.max_discount === "number" ||
      typeof value.max_discount === "string" ||
      value.max_discount === null) &&
    isNullableString(value.starts_at) &&
    isNullableString(value.ends_at) &&
    (typeof value.is_active === "boolean" || value.is_active === null)
  );
}

// 将 coupons 表记录映射成前端直接可用的优惠券对象。
function mapCoupon(row: CouponRow): Coupon {
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

function isUserCouponRow(value: unknown): value is UserCouponRow {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.coupon_id !== "string" ||
    !isUserCouponStatus(value.status) ||
    typeof value.claimed_at !== "string" ||
    !isNullableString(value.locked_at) ||
    !isNullableString(value.lock_expires_at) ||
    !isNullableString(value.used_at) ||
    !isNullableString(value.order_id)
  ) {
    return false;
  }

  const coupon = getRelation(value.coupon as CouponRow | CouponRow[] | null | undefined);
  return coupon === null || isCouponRow(coupon);
}

// 将 user_coupons 联表结果映射成结算页使用的用户优惠券结构。
function mapUserCoupon(row: UserCouponRow): UserCoupon {
  const coupon = getRelation(row.coupon);

  return {
    id: row.id,
    couponId: row.coupon_id,
    status: row.status,
    claimedAt: row.claimed_at,
    lockedAt: row.locked_at ?? null,
    lockExpiresAt: row.lock_expires_at ?? null,
    usedAt: row.used_at ?? null,
    orderId: row.order_id ?? null,
    coupon: coupon ? mapCoupon(coupon) : null,
  };
}

// 统一读取当前登录用户 id，避免每个 action 重复拆 session。
async function getSessionUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function isClaimCouponResponse(value: unknown): value is ClaimCouponResponse {
  return (
    isRecord(value) &&
    typeof value.userCouponId === "string" &&
    value.userCouponId.trim().length > 0
  );
}

function isCouponCacheFresh(fetchedAt: number, minFreshMs: number) {
  return fetchedAt > 0 && Date.now() - fetchedAt < minFreshMs;
}

function resetCouponRequestCache() {
  publicCouponsFetchedAt = 0;
  userCouponsFetchedAt = 0;
  lastFetchedUserCouponsUserId = null;
  publicCouponsInFlight = null;
  userCouponsInFlight = null;
  userCouponsInFlightUserId = null;
  publicCouponsRequestId += 1;
  userCouponsRequestId += 1;
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
  fetchPublicCoupons: async (options) => {
    const force = options?.force === true;
    const minFreshMs = options?.minFreshMs ?? COUPON_CACHE_TTL_MS;

    if (
      !force &&
      get().publicCoupons.length > 0 &&
      isCouponCacheFresh(publicCouponsFetchedAt, minFreshMs)
    ) {
      return;
    }

    if (!force && publicCouponsInFlight) {
      return publicCouponsInFlight;
    }

    const requestId = ++publicCouponsRequestId;
    const request = (async () => {
      try {
        set({ loadingPublic: true });
        const { data, error } = await supabase
          .from("coupons")
          .select(
            "id, title, description, code, discount_type, discount_value, min_spend, max_discount, starts_at, ends_at, is_active",
          )
          .order("ends_at", { ascending: true })
          .limit(50);

        if (error) {
          throw error;
        }

        const publicCoupons = Array.isArray(data)
          ? data.filter(isCouponRow).map(mapCoupon)
          : [];

        if (requestId !== publicCouponsRequestId) {
          return;
        }

        publicCouponsFetchedAt = Date.now();
        set({ publicCoupons, loadingPublic: false });
      } catch (error) {
        logWarn("couponStore", "fetchPublicCoupons 失败", {
          error: error instanceof Error ? error.message : String(error),
        });

        if (requestId === publicCouponsRequestId) {
          set({ loadingPublic: false });
        }
      } finally {
        if (requestId === publicCouponsRequestId) {
          publicCouponsInFlight = null;
        }
      }
    })();

    publicCouponsInFlight = request;
    return request;
  },

  // 拉取当前用户已领取的优惠券，并校验当前选中的券是否仍然可用。
  fetchUserCoupons: async (options) => {
    const force = options?.force === true;
    const minFreshMs = options?.minFreshMs ?? COUPON_CACHE_TTL_MS;
    const userId = await getSessionUserId();

    if (!userId) {
      userCouponsFetchedAt = 0;
      lastFetchedUserCouponsUserId = null;
      userCouponsInFlightUserId = null;
      set({ userCoupons: [], selectedUserCouponId: null, loadingUser: false });
      return;
    }

    if (
      !force &&
      lastFetchedUserCouponsUserId === userId &&
      get().userCoupons.length > 0 &&
      isCouponCacheFresh(userCouponsFetchedAt, minFreshMs)
    ) {
      return;
    }

    if (!force && userCouponsInFlight && userCouponsInFlightUserId === userId) {
      return userCouponsInFlight;
    }

    const requestId = ++userCouponsRequestId;
    const request = (async () => {
      try {
        set({ loadingUser: true });
        const { data, error } = await supabase
          .from("user_coupons")
          .select(
            "id, coupon_id, status, claimed_at, locked_at, lock_expires_at, used_at, order_id, coupon:coupons(id, title, description, code, discount_type, discount_value, min_spend, max_discount, starts_at, ends_at, is_active)",
          )
          .eq("user_id", userId)
          .order("claimed_at", { ascending: false })
          .limit(50);

        if (error) {
          throw error;
        }

        const userCoupons = Array.isArray(data)
          ? data.filter(isUserCouponRow).map(mapUserCoupon)
          : [];
        const currentSelectedId = get().selectedUserCouponId;

        if (requestId !== userCouponsRequestId) {
          return;
        }

        userCouponsFetchedAt = Date.now();
        lastFetchedUserCouponsUserId = userId;
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

        if (requestId === userCouponsRequestId) {
          set({ loadingUser: false });
        }
      } finally {
        if (requestId === userCouponsRequestId) {
          userCouponsInFlight = null;
          userCouponsInFlightUserId = null;
        }
      }
    })();

    userCouponsInFlight = request;
    userCouponsInFlightUserId = userId;
    return request;
  },

  // 统一封装领取入口，成功后同步刷新公开券和用户券列表。
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
}));
