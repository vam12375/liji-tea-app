interface AvailableUserCouponLike {
  id: string;
  status: "available" | "locked" | "used" | "expired";
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
