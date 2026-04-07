import { createServiceClient } from "./supabase.ts";

// 用户券在订单创建后的锁定时长，超时未支付会被释放回可用状态。
const COUPON_LOCK_MINUTES = 10;

export interface CouponRow {
  id: string;
  title: string;
  description: string | null;
  code: string;
  discount_type: string;
  discount_value: number | string | null;
  min_spend: number | string | null;
  max_discount: number | string | null;
  total_limit: number | null;
  per_user_limit: number | null;
  claimed_count: number | null;
  used_count: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
}

export interface UserCouponRow {
  id: string;
  coupon_id: string;
  user_id: string;
  status: string;
  claimed_at: string;
  locked_at: string | null;
  lock_expires_at: string | null;
  used_at: string | null;
  order_id: string | null;
  coupon: CouponRow | null;
}

// 计算优惠券可抵扣金额时所需的订单金额上下文。
export interface CouponPricingContext {
  subtotal: number;
  shipping: number;
  autoDiscount: number;
  giftWrapFee: number;
}

export interface AppliedCouponSummary {
  couponId: string;
  userCouponId: string;
  code: string;
  title: string;
  discountType: string;
  discountValue: number;
  minSpend: number;
  maxDiscount: number | null;
  discountAmount: number;
}

export interface CouponPricingResult {
  couponDiscount: number;
  appliedCoupon: AppliedCouponSummary | null;
}

interface ClaimCouponInput {
  userId: string;
  couponId?: string | null;
  code?: string | null;
}

// 兼容 Supabase numeric / text 返回值，统一转换成可计算的 number。
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number) {
  return Number(toNumber(value).toFixed(2));
}

// 统一生成数据库写入时间，避免各处重复 new Date().toISOString()。
function nowIso() {
  return new Date().toISOString();
}

// 基于锁券时长计算本次锁定的失效时间。
function getCouponLockExpiresAt() {
  return new Date(Date.now() + COUPON_LOCK_MINUTES * 60 * 1000).toISOString();
}

function isCouponStarted(coupon: CouponRow, now = Date.now()) {
  if (!coupon.starts_at) {
    return true;
  }

  const startsAt = new Date(coupon.starts_at).getTime();
  return Number.isNaN(startsAt) ? true : startsAt <= now;
}

function isCouponEnded(coupon: CouponRow, now = Date.now()) {
  if (!coupon.ends_at) {
    return false;
  }

  const endsAt = new Date(coupon.ends_at).getTime();
  return Number.isNaN(endsAt) ? false : endsAt < now;
}

function isCouponActive(coupon: CouponRow, now = Date.now()) {
  return coupon.is_active === true && isCouponStarted(coupon, now) && !isCouponEnded(coupon, now);
}

// 根据 couponId 或兑换码读取优惠券，供领取入口复用。
async function fetchCouponByInput(input: ClaimCouponInput) {
  const supabase = createServiceClient();
  const couponId = input.couponId?.trim();
  const code = input.code?.trim().toUpperCase();

  if (!couponId && !code) {
    return { data: null, error: "缺少优惠券标识。" };
  }

  let query = supabase.from("coupons").select(
    "id, title, description, code, discount_type, discount_value, min_spend, max_discount, total_limit, per_user_limit, claimed_count, used_count, starts_at, ends_at, is_active",
  );

  if (couponId) {
    query = query.eq("id", couponId);
  } else if (code) {
    query = query.ilike("code", code);
  }

  const { data, error } = await query.maybeSingle<CouponRow>();

  if (error) {
    return { data: null, error: "读取优惠券失败。" };
  }

  if (!data) {
    return { data: null, error: "优惠券不存在。" };
  }

  return { data, error: null };
}

async function fetchUserCoupon(userId: string, userCouponId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_coupons")
    .select(
      "id, coupon_id, user_id, status, claimed_at, locked_at, lock_expires_at, used_at, order_id, coupon:coupons(id, title, description, code, discount_type, discount_value, min_spend, max_discount, total_limit, per_user_limit, claimed_count, used_count, starts_at, ends_at, is_active)",
    )
    .eq("id", userCouponId)
    .eq("user_id", userId)
    .maybeSingle<UserCouponRow>();

  return { data, error };
}

// 如果用户券已经超过锁定时效，则自动释放，避免旧订单长期占券。
async function releaseExpiredLockedCoupon(userCoupon: UserCouponRow) {
  if (userCoupon.status !== "locked" || !userCoupon.lock_expires_at) {
    return { released: false, error: null };
  }

  const lockExpiresAt = new Date(userCoupon.lock_expires_at).getTime();
  if (Number.isNaN(lockExpiresAt) || lockExpiresAt > Date.now()) {
    return { released: false, error: null };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("user_coupons")
    .update({
      status: "available",
      locked_at: null,
      lock_expires_at: null,
      order_id: null,
      updated_at: nowIso(),
    })
    .eq("id", userCoupon.id)
    .eq("status", "locked");

  return { released: !error, error };
}

async function markUserCouponExpired(userCoupon: UserCouponRow) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("user_coupons")
    .update({
      status: "expired",
      lock_expires_at: null,
      locked_at: null,
      order_id: null,
      updated_at: nowIso(),
    })
    .eq("id", userCoupon.id)
    .in("status", ["available", "locked"]);

  return { error };
}

// 按优惠券类型、门槛和封顶规则计算当前订单可使用的抵扣金额。
function calculateCouponDiscount(coupon: CouponRow, context: CouponPricingContext) {
  const subtotal = roundCurrency(context.subtotal);
  const autoDiscount = roundCurrency(context.autoDiscount);
  const eligibleAmount = roundCurrency(Math.max(subtotal - autoDiscount, 0));
  const minSpend = roundCurrency(toNumber(coupon.min_spend));

  if (subtotal < minSpend) {
    return {
      discountAmount: 0,
      error: `当前订单未达到优惠券使用门槛，满 ¥${minSpend.toFixed(2)} 可用。`,
    };
  }

  if (eligibleAmount <= 0) {
    return {
      discountAmount: 0,
      error: "当前订单金额不足，暂时无法使用该优惠券。",
    };
  }

  const discountType = coupon.discount_type;
  const discountValue = roundCurrency(toNumber(coupon.discount_value));
  const maxDiscount =
    coupon.max_discount === null ? null : roundCurrency(toNumber(coupon.max_discount));

  let discountAmount = 0;

  if (discountType === "fixed") {
    discountAmount = discountValue;
  } else if (discountType === "percent") {
    discountAmount = roundCurrency(eligibleAmount * (discountValue / 100));
  } else {
    return {
      discountAmount: 0,
      error: "优惠券类型无效。",
    };
  }

  if (maxDiscount !== null) {
    discountAmount = Math.min(discountAmount, maxDiscount);
  }

  discountAmount = roundCurrency(Math.min(discountAmount, eligibleAmount));

  if (discountAmount <= 0) {
    return {
      discountAmount: 0,
      error: "当前订单暂时无法使用该优惠券。",
    };
  }

  return {
    discountAmount,
    error: null,
  };
}

// 在下单或询价前校验用户券状态，并返回可直接并入订单金额的优惠结果。
export async function resolveCouponPricingForUser(params: {
  userId: string;
  userCouponId?: string | null;
  context: CouponPricingContext;
}) {
  const userCouponId = params.userCouponId?.trim();
  if (!userCouponId) {
    return {
      data: {
        couponDiscount: 0,
        appliedCoupon: null,
      } as CouponPricingResult,
      error: null,
    };
  }

  let { data: userCoupon, error } = await fetchUserCoupon(params.userId, userCouponId);

  if (error) {
    return {
      data: null,
      error: "读取用户优惠券失败。",
    };
  }

  if (!userCoupon) {
    return {
      data: null,
      error: "优惠券不存在或不属于当前用户。",
    };
  }

  const releaseResult = await releaseExpiredLockedCoupon(userCoupon);
  if (releaseResult.error) {
    return {
      data: null,
      error: "刷新优惠券状态失败。",
    };
  }

  if (releaseResult.released) {
    const refreshed = await fetchUserCoupon(params.userId, userCouponId);
    userCoupon = refreshed.data ?? userCoupon;
    if (refreshed.error) {
      return {
        data: null,
        error: "刷新优惠券状态失败。",
      };
    }
  }

  if (!userCoupon.coupon) {
    return {
      data: null,
      error: "优惠券信息不存在。",
    };
  }

  if (isCouponEnded(userCoupon.coupon)) {
    await markUserCouponExpired(userCoupon);
    return {
      data: null,
      error: "优惠券已过期。",
    };
  }

  if (!isCouponActive(userCoupon.coupon)) {
    return {
      data: null,
      error: "优惠券当前不可用。",
    };
  }

  if (userCoupon.status === "used") {
    return {
      data: null,
      error: "该优惠券已使用。",
    };
  }

  if (userCoupon.status === "expired") {
    return {
      data: null,
      error: "该优惠券已过期。",
    };
  }

  if (userCoupon.status === "locked") {
    return {
      data: null,
      error: "该优惠券已被其他订单占用，请稍后再试。",
    };
  }

  const calculated = calculateCouponDiscount(userCoupon.coupon, params.context);
  if (calculated.error) {
    return {
      data: null,
      error: calculated.error,
    };
  }

  return {
    data: {
      couponDiscount: calculated.discountAmount,
      appliedCoupon: {
        couponId: userCoupon.coupon.id,
        userCouponId: userCoupon.id,
        code: userCoupon.coupon.code,
        title: userCoupon.coupon.title,
        discountType: userCoupon.coupon.discount_type,
        discountValue: roundCurrency(toNumber(userCoupon.coupon.discount_value)),
        minSpend: roundCurrency(toNumber(userCoupon.coupon.min_spend)),
        maxDiscount:
          userCoupon.coupon.max_discount === null
            ? null
            : roundCurrency(toNumber(userCoupon.coupon.max_discount)),
        discountAmount: calculated.discountAmount,
      },
    } as CouponPricingResult,
    error: null,
  };
}

// 订单创建成功后立即锁券，防止同一张券被并发订单重复占用。
export async function lockUserCouponForOrder(params: {
  userId: string;
  userCouponId: string;
  orderId: string;
}) {
  const userCouponId = params.userCouponId.trim();
  const orderId = params.orderId.trim();

  if (!userCouponId || !orderId) {
    return { data: null, error: "缺少锁定优惠券所需参数。" };
  }

  const { data: userCoupon, error } = await fetchUserCoupon(params.userId, userCouponId);
  if (error) {
    return { data: null, error: "读取用户优惠券失败。" };
  }

  if (!userCoupon) {
    return { data: null, error: "优惠券不存在或不属于当前用户。" };
  }

  const releaseResult = await releaseExpiredLockedCoupon(userCoupon);
  if (releaseResult.error) {
    return { data: null, error: "刷新优惠券锁定状态失败。" };
  }

  const refreshedResult = await fetchUserCoupon(params.userId, userCouponId);
  const refreshedCoupon = refreshedResult.data ?? userCoupon;

  if (refreshedResult.error) {
    return { data: null, error: "刷新优惠券锁定状态失败。" };
  }

  if (!refreshedCoupon.coupon || !isCouponActive(refreshedCoupon.coupon)) {
    return { data: null, error: "优惠券当前不可用。" };
  }

  if (isCouponEnded(refreshedCoupon.coupon)) {
    await markUserCouponExpired(refreshedCoupon);
    return { data: null, error: "优惠券已过期。" };
  }

  if (refreshedCoupon.status !== "available") {
    return { data: null, error: "该优惠券当前不可锁定。" };
  }

  const lockExpiresAt = getCouponLockExpiresAt();
  const supabase = createServiceClient();
  const { data, error: updateError } = await supabase
    .from("user_coupons")
    .update({
      status: "locked",
      locked_at: nowIso(),
      lock_expires_at: lockExpiresAt,
      order_id: orderId,
      updated_at: nowIso(),
    })
    .eq("id", userCouponId)
    .eq("user_id", params.userId)
    .eq("status", "available")
    .select("id, coupon_id, lock_expires_at")
    .maybeSingle<{ id: string; coupon_id: string; lock_expires_at: string | null }>();

  if (updateError || !data) {
    return { data: null, error: "锁定优惠券失败，请稍后重试。" };
  }

  return {
    data: {
      userCouponId: data.id,
      couponId: data.coupon_id,
      lockExpiresAt: data.lock_expires_at,
    },
    error: null,
  };
}

// 订单取消、超时关闭或支付失败后释放已锁定的用户券。
export async function releaseLockedCoupon(params: {
  userCouponId?: string | null;
  orderId?: string | null;
}) {
  if (!params.userCouponId && !params.orderId) {
    return { error: null };
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("user_coupons")
    .update({
      status: "available",
      locked_at: null,
      lock_expires_at: null,
      order_id: null,
      updated_at: nowIso(),
    })
    .eq("status", "locked");

  if (params.userCouponId) {
    query = query.eq("id", params.userCouponId);
  }

  if (params.orderId) {
    query = query.eq("order_id", params.orderId);
  }

  const { error } = await query;
  return { error };
}

// 支付成功后将锁定中的用户券置为已使用，并累加优惠券使用次数。
export async function markLockedCouponUsed(params: {
  userCouponId?: string | null;
  couponId?: string | null;
  orderId: string;
  usedAt?: string;
}) {
  if (!params.userCouponId) {
    return { error: null, used: false };
  }

  const supabase = createServiceClient();
  const { data: currentCoupon, error: currentError } = await supabase
    .from("user_coupons")
    .select("id, coupon_id, status, order_id")
    .eq("id", params.userCouponId)
    .maybeSingle<{ id: string; coupon_id: string; status: string; order_id: string | null }>();

  if (currentError) {
    return { error: currentError, used: false };
  }

  if (!currentCoupon) {
    return { error: null, used: false };
  }

  if (currentCoupon.status === "used" && currentCoupon.order_id === params.orderId) {
    return { error: null, used: false };
  }

  const usedAt = params.usedAt ?? nowIso();
  const { error: updateError } = await supabase
    .from("user_coupons")
    .update({
      status: "used",
      used_at: usedAt,
      locked_at: null,
      lock_expires_at: null,
      order_id: params.orderId,
      updated_at: usedAt,
    })
    .eq("id", params.userCouponId)
    .in("status", ["available", "locked"]);

  if (updateError) {
    return { error: updateError, used: false };
  }

  const couponId = params.couponId ?? currentCoupon.coupon_id;
  // 原子递增 used_count，避免并发读后写竞态
  const { error: countError } = await supabase
    .from("coupons")
    .update({
      used_count: supabase.rpc ? undefined : undefined, // 占位，下面用 SQL
      updated_at: usedAt,
    })
    .eq("id", couponId);

  // 使用原子递增：used_count = used_count + 1
  const { error: atomicError } = await supabase.rpc(
    'increment_coupon_used_count' as any,
    { p_coupon_id: couponId },
  );

  // 如果 RPC 不存在，回退到普通更新
  if (atomicError?.message?.includes('function') || atomicError?.code === '42883') {
    const { data: couponRow, error: couponError } = await supabase
      .from("coupons")
      .select("used_count")
      .eq("id", couponId)
      .maybeSingle<{ used_count: number | null }>();

    if (!couponError && couponRow) {
      await supabase
        .from("coupons")
        .update({
          used_count: (couponRow.used_count ?? 0) + 1,
          updated_at: usedAt,
        })
        .eq("id", couponId);
    }
  }

  return {
    error: atomicError?.message?.includes('function') ? null : (atomicError ?? countError),
    used: true,
  };
}

// 用户正式领取优惠券的入口，使用原子性 SQL 防止并发超领。
export async function claimCouponForUser(input: ClaimCouponInput) {
  const userId = input.userId.trim();
  if (!userId) {
    return { data: null, error: "未登录或登录状态已失效。" };
  }

  const couponResult = await fetchCouponByInput(input);
  if (couponResult.error || !couponResult.data) {
    return { data: null, error: couponResult.error ?? "优惠券不存在。" };
  }

  const coupon = couponResult.data;
  if (!isCouponActive(coupon)) {
    return { data: null, error: "优惠券当前不可领取。" };
  }

  const perUserLimit = coupon.per_user_limit ?? 1;
  const supabase = createServiceClient();
  const now = nowIso();

  // 使用原子性 INSERT ... SELECT，在单条 SQL 中同时检查库存和用户领取上限
  // 避免并发请求间的 check-then-insert 竞态条件
  const { data: inserted, error: insertError } = await supabase.rpc(
    'claim_coupon_atomic' as any,
    {
      p_user_id: userId,
      p_coupon_id: coupon.id,
      p_per_user_limit: perUserLimit,
      p_now: now,
    },
  );

  // 如果没有 RPC 函数可用，回退到普通插入（带乐观锁保护）
  if (insertError?.message?.includes('function') || insertError?.code === '42883') {
    // 回退方案：使用条件插入 + 乐观并发控制
    const { count, error: countError } = await supabase
      .from("user_coupons")
      .select("id", { head: true, count: "exact" })
      .eq("coupon_id", coupon.id)
      .eq("user_id", userId);

    if (countError) {
      return { data: null, error: "检查优惠券领取次数失败。" };
    }

    if ((count ?? 0) >= perUserLimit) {
      return { data: null, error: "您已达到该优惠券的领取上限。" };
    }

    if (coupon.total_limit !== null && (coupon.claimed_count ?? 0) >= coupon.total_limit) {
      return { data: null, error: "该优惠券已被领完。" };
    }

    const { data: userCoupon, error: fallbackInsertError } = await supabase
      .from("user_coupons")
      .insert({
        coupon_id: coupon.id,
        user_id: userId,
        status: "available",
        claimed_at: now,
        created_at: now,
        updated_at: now,
      })
      .select(
        "id, coupon_id, user_id, status, claimed_at, locked_at, lock_expires_at, used_at, order_id, coupon:coupons(id, title, description, code, discount_type, discount_value, min_spend, max_discount, total_limit, per_user_limit, claimed_count, used_count, starts_at, ends_at, is_active)",
      )
      .single<UserCouponRow>();

    if (fallbackInsertError || !userCoupon) {
      return { data: null, error: "领取优惠券失败。" };
    }

    // 原子递增 claimed_count，避免读后写竞态
    const { error: claimedCountError } = await supabase.rpc(
      'increment_coupon_claimed_count' as any,
      { p_coupon_id: coupon.id },
    );

    // 如果 RPC 不存在，回退到原子 UPDATE
    if (claimedCountError?.message?.includes('function') || claimedCountError?.code === '42883') {
      await supabase
        .from("coupons")
        .update({
          claimed_count: (coupon.claimed_count ?? 0) + 1,
          updated_at: now,
        })
        .eq("id", coupon.id);
    } else if (claimedCountError) {
      return { data: null, error: "更新优惠券领取数量失败。" };
    }

    return { data: userCoupon, error: null };
  }

  if (insertError) {
    return { data: null, error: "领取优惠券失败。" };
  }

  if (!inserted) {
    // 原子检查未通过（库存不足或已达上限）
    // 再查一次具体原因返回给用户
    if (coupon.total_limit !== null && (coupon.claimed_count ?? 0) >= coupon.total_limit) {
      return { data: null, error: "该优惠券已被领完。" };
    }
    return { data: null, error: "您已达到该优惠券的领取上限。" };
  }

  // 原子递增 claimed_count
  await supabase
    .from("coupons")
    .update({ updated_at: now })
    .eq("id", coupon.id);

  // 重新查询完整的 user_coupon 数据返回
  const { data: userCoupon, error: fetchError } = await supabase
    .from("user_coupons")
    .select(
      "id, coupon_id, user_id, status, claimed_at, locked_at, lock_expires_at, used_at, order_id, coupon:coupons(id, title, description, code, discount_type, discount_value, min_spend, max_discount, total_limit, per_user_limit, claimed_count, used_count, starts_at, ends_at, is_active)",
    )
    .eq("user_id", userId)
    .eq("coupon_id", coupon.id)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .single<UserCouponRow>();

  if (fetchError || !userCoupon) {
    return { data: null, error: "领取成功但查询结果失败。" };
  }

  return { data: userCoupon, error: null };
}
