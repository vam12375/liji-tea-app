export const COUPON_CACHE_TTL_MS = 30_000;

// 优惠券请求缓存统一集中到这里，避免 store 入口继续持有一堆模块级变量。
export const couponRequestCache = {
  publicCouponsFetchedAt: 0,
  userCouponsFetchedAt: 0,
  lastFetchedUserCouponsUserId: null as string | null,
  publicCouponsInFlight: null as Promise<void> | null,
  userCouponsInFlight: null as Promise<void> | null,
  userCouponsInFlightUserId: null as string | null,
  publicCouponsRequestId: 0,
  userCouponsRequestId: 0,
};

export function isCouponCacheFresh(fetchedAt: number, minFreshMs: number) {
  return fetchedAt > 0 && Date.now() - fetchedAt < minFreshMs;
}

export function resetCouponRequestCache() {
  couponRequestCache.publicCouponsFetchedAt = 0;
  couponRequestCache.userCouponsFetchedAt = 0;
  couponRequestCache.lastFetchedUserCouponsUserId = null;
  couponRequestCache.publicCouponsInFlight = null;
  couponRequestCache.userCouponsInFlight = null;
  couponRequestCache.userCouponsInFlightUserId = null;
  couponRequestCache.publicCouponsRequestId += 1;
  couponRequestCache.userCouponsRequestId += 1;
}
