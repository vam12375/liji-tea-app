import type { AfterSaleRequest, Order, Product } from "@/types/database";

// 商家端列表筛选纯函数：便于单测覆盖所有分支，store 层只做 state + IO。

// ========== 订单 ==========

// pending_ship 聚合 status=paid（付款完成、等待发货）。
export type MerchantOrderScope =
  | "all"
  | "pending_ship"
  | "shipping"
  | "delivered"
  | "cancelled";

export interface MerchantOrderFilter {
  status: MerchantOrderScope;
  keyword: string;
}

export function filterMerchantOrders(
  list: Order[],
  filter: MerchantOrderFilter,
): Order[] {
  const keyword = filter.keyword.trim().toLowerCase();
  const matched = list.filter((order) => {
    const scopeHit =
      filter.status === "all" ||
      (filter.status === "pending_ship" && order.status === "paid") ||
      filter.status === order.status;
    if (!scopeHit) return false;
    if (!keyword) return true;
    // 订单号：优先 order_no；兜底 id 前 8 位。
    const no = (order.order_no ?? order.id ?? "").toLowerCase();
    // 收件人手机：优先冗余列 logistics_receiver_phone。
    const phone = (order.logistics_receiver_phone ?? "").toLowerCase();
    return no.includes(keyword) || phone.includes(keyword);
  });
  return matched.sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
}

// ========== 售后 ==========

// 映射到当前售后域枚举：submitted / pending_review / auto_approved 被统一视为“待审核”。
export type MerchantAfterSaleScope =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "refunded";

export function filterMerchantAfterSales(
  list: AfterSaleRequest[],
  filter: { status: MerchantAfterSaleScope },
): AfterSaleRequest[] {
  if (filter.status === "all") return [...list];
  return list.filter((req) => {
    if (filter.status === "pending") {
      return ["submitted", "pending_review", "auto_approved"].includes(req.status);
    }
    return req.status === filter.status;
  });
}

// ========== 商品 ==========

export type MerchantProductScope = "all" | "active" | "inactive" | "low_stock";

export interface MerchantProductFilter {
  scope: MerchantProductScope;
  keyword: string;
}

// 低库存阈值：MVP 写死 10，后续如需可配置再抽成参数。
export const LOW_STOCK_THRESHOLD = 10;

export function filterMerchantProducts(
  list: Product[],
  filter: MerchantProductFilter,
): Product[] {
  const keyword = filter.keyword.trim().toLowerCase();
  return list.filter((p) => {
    const scopeHit =
      filter.scope === "all" ||
      (filter.scope === "active" && p.is_active === true) ||
      (filter.scope === "inactive" && p.is_active === false) ||
      (filter.scope === "low_stock" && (p.stock ?? 0) < LOW_STOCK_THRESHOLD);
    if (!scopeHit) return false;
    if (!keyword) return true;
    return p.name?.toLowerCase().includes(keyword);
  });
}
