export interface CancelPendingOrderRpcRow {
  released: boolean;
  order_status: string;
  payment_status: string;
}

export interface NormalizedCancelPendingOrderResponse {
  released: boolean;
  orderStatus: string;
  paymentStatus: string;
}

function isCancelPendingOrderRpcRow(
  value: unknown,
): value is CancelPendingOrderRpcRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "released" in value &&
    "order_status" in value &&
    "payment_status" in value &&
    typeof value.released === "boolean" &&
    typeof value.order_status === "string" &&
    typeof value.payment_status === "string"
  );
}

/**
 * 将数据库 / RPC 的 snake_case 返回值转换为前端使用的 camelCase 结构。
 */
export function normalizeCancelPendingOrderResponse(
  value: unknown,
): NormalizedCancelPendingOrderResponse | null {
  if (!isCancelPendingOrderRpcRow(value)) {
    return null;
  }

  return {
    released: value.released,
    orderStatus: value.order_status,
    paymentStatus: value.payment_status,
  };
}
