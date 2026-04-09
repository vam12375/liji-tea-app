import type { Order } from "@/types/database";

export const PENDING_ORDER_EXPIRE_MS = 10 * 60 * 1000;
export const PENDING_ORDER_EXPIRE_MINUTES = PENDING_ORDER_EXPIRE_MS / 60_000;

export function getPendingPaymentDeadline(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return null;
  }

  return createdTime + PENDING_ORDER_EXPIRE_MS;
}

export function formatRemainingPaymentTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function isPendingOrderExpired(order: Pick<Order, "status" | "created_at">) {
  if (order.status !== "pending") {
    return false;
  }

  const createdAt = new Date(order.created_at).getTime();
  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt >= PENDING_ORDER_EXPIRE_MS;
}
