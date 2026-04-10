import type {
  ClaimCouponResponse,
  Coupon,
  CouponDiscountType,
  UserCoupon,
  UserCouponStatus,
} from "@/stores/couponStore.types";

export type CouponRow = {
  id: string;
  title: string;
 description: string | null;
  code: string;
  scope: Coupon["scope"];
 scope_category_ids?: string[] | null;
  scope_product_ids?: string[] | null;
  discount_type: CouponDiscountType;
  discount_value: number | string | null;
  min_spend: number | string | null;
  max_discount: number | string | null;
 starts_at: string | null;
  ends_at: string | null;
 is_active: boolean | null;
};

export type UserCouponRow = {
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

function isCouponDiscountType(value: unknown): value is CouponDiscountType {
  return value === "fixed" || value === "percent";
}

export function isCouponRow(value: unknown): value is CouponRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
 isNullableString(value.description) &&
    typeof value.code === "string" &&
    (value.scope === "all" ||
      value.scope === "shipping" ||
      value.scope === "category" ||
      value.scope === "product") &&
    (Array.isArray(value.scope_category_ids) ||
      value.scope_category_ids === null ||
      value.scope_category_ids === undefined) &&
    (Array.isArray(value.scope_product_ids) ||
      value.scope_product_ids === null ||
      value.scope_product_ids === undefined) &&
    isCouponDiscountType(value.discount_type) &&
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
export function mapCoupon(row: CouponRow): Coupon {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    code: row.code,
    discountType: row.discount_type,
    discountValue: toNumber(row.discount_value),
    minSpend: toNumber(row.min_spend),
    maxDiscount: row.max_discount === null ? null : toNumber(row.max_discount),
 scope: row.scope,
    scopeCategoryIds: Array.isArray(row.scope_category_ids) ? row.scope_category_ids : [],
    scopeProductIds: Array.isArray(row.scope_product_ids) ? row.scope_product_ids : [],
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    isActive: row.is_active === true,
  };
}

export function isUserCouponRow(value: unknown): value is UserCouponRow {
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

  const coupon = getRelation(
    value.coupon as CouponRow | CouponRow[] | null | undefined,
  );
  return coupon === null || isCouponRow(coupon);
}

// 将 user_coupons 联表结果映射成结算页使用的用户优惠券结构。
export function mapUserCoupon(row: UserCouponRow): UserCoupon {
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

export function isClaimCouponResponse(
  value: unknown,
): value is ClaimCouponResponse {
  return (
    isRecord(value) &&
    typeof value.userCouponId === "string" &&
    value.userCouponId.trim().length > 0
  );
}
