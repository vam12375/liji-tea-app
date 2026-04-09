import { logWarn } from "@/lib/logger";
import {
  type OrderItemRow,
  type OrderRow,
  isOrderRow,
} from "@/lib/orderGuards";
import type { Order, OrderItem } from "@/types/database";

/** 将数据库返回的可空字段规范成前端统一使用的 `OrderItem` 结构。 */
export function normalizeOrderItemRow(row: OrderItemRow): OrderItem {
  return {
    ...row,
    product: row.product ?? undefined,
  };
}

/** 将数据库返回的可空字段规范成前端统一使用的 `Order` 结构。 */
export function normalizeOrderRow(row: OrderRow): Order {
  return {
    ...row,
    coupon_discount: row.coupon_discount ?? undefined,
    order_items: row.order_items?.map(normalizeOrderItemRow) ?? undefined,
    address: row.address ?? undefined,
  };
}

/** 列表接口返回弱类型数组，这里逐项过滤非法数据，避免污染 store。 */
export function parseOrderList(data: unknown): Order[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const orders: Order[] = [];

  for (const item of data) {
    if (!isOrderRow(item)) {
      logWarn("orderMappers", "跳过不合法订单数据", { item });
      continue;
    }

    orders.push(normalizeOrderRow(item));
  }

  return orders;
}

/**单条订单详情解析失败时返回 null，交由上层决定空态或错误态展示。 */
export function parseOrder(data: unknown): Order | null {
  if (!isOrderRow(data)) {
    if (data != null) {
      logWarn("orderMappers", "收到不合法订单详情", { data });
    }

    return null;
  }

  return normalizeOrderRow(data);
}
