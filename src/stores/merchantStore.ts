import { create } from "zustand";

import { logWarn } from "@/lib/logger";
import { classifyMerchantError, isMerchantError } from "@/lib/merchantErrors";
import type {
  MerchantAfterSaleScope,
  MerchantOrderFilter,
  MerchantProductFilter,
} from "@/lib/merchantFilters";
import { merchantRpc } from "@/lib/merchantRpc";
import { supabase } from "@/lib/supabase";
import type { AfterSaleRequest, Order, Product } from "@/types/database";

// 商家端数据源集中 store：
// - 列表：fetch* 从 supabase 拉全量；视图层用 filter* 纯函数二次筛选。
// - 写：所有写走 merchantRpc，成功把返回行回填到对应数组；失败由页面层 catch。

interface MerchantState {
  orders: Order[];
  ordersLoading: boolean;
  orderFilter: MerchantOrderFilter;

  afterSales: AfterSaleRequest[];
  afterSalesLoading: boolean;
  afterSaleFilter: { status: MerchantAfterSaleScope };

  products: Product[];
  productsLoading: boolean;
  productFilter: MerchantProductFilter;

  setOrderFilter: (patch: Partial<MerchantOrderFilter>) => void;
  setAfterSaleFilter: (patch: Partial<{ status: MerchantAfterSaleScope }>) => void;
  setProductFilter: (patch: Partial<MerchantProductFilter>) => void;

  fetchOrders: () => Promise<void>;
  fetchAfterSales: () => Promise<void>;
  fetchProducts: () => Promise<void>;

  shipOrder: (orderId: string, carrier: string, trackingNo: string) => Promise<void>;
  closeOrder: (orderId: string, reason: string) => Promise<void>;

  approveRefund: (requestId: string, amount: number, note: string) => Promise<void>;
  rejectRefund: (requestId: string, reason: string) => Promise<void>;
  markRefundCompleted: (requestId: string, txnId: string) => Promise<void>;

  updateProduct: (productId: string, patch: Record<string, unknown>) => Promise<void>;
  updateStock: (productId: string, delta: number, reason: string) => Promise<void>;
}

function mergeRow<T extends { id: string }>(list: T[], next: T) {
  return list.map((item) => (item.id === next.id ? next : item));
}

export const useMerchantStore = create<MerchantState>((set, get) => ({
  orders: [],
  ordersLoading: false,
  orderFilter: { status: "pending_ship", keyword: "" },

  afterSales: [],
  afterSalesLoading: false,
  afterSaleFilter: { status: "pending" },

  products: [],
  productsLoading: false,
  productFilter: { scope: "all", keyword: "" },

  setOrderFilter: (patch) =>
    set({ orderFilter: { ...get().orderFilter, ...patch } }),
  setAfterSaleFilter: (patch) =>
    set({ afterSaleFilter: { ...get().afterSaleFilter, ...patch } }),
  setProductFilter: (patch) =>
    set({ productFilter: { ...get().productFilter, ...patch } }),

  fetchOrders: async () => {
    set({ ordersLoading: true });
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      logWarn("merchantStore", "拉取订单失败", { error: error.message });
    }
    set({ orders: (data as Order[] | null) ?? [], ordersLoading: false });
  },

  fetchAfterSales: async () => {
    set({ afterSalesLoading: true });
    const { data, error } = await supabase
      .from("after_sale_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      logWarn("merchantStore", "拉取售后失败", { error: error.message });
    }
    set({
      afterSales: (data as AfterSaleRequest[] | null) ?? [],
      afterSalesLoading: false,
    });
  },

  fetchProducts: async () => {
    set({ productsLoading: true });
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      logWarn("merchantStore", "拉取商品失败", { error: error.message });
    }
    set({
      products: (data as Product[] | null) ?? [],
      productsLoading: false,
    });
  },

  shipOrder: async (orderId, carrier, trackingNo) => {
    try {
      const updated = await merchantRpc.shipOrder(orderId, carrier, trackingNo);
      set({ orders: mergeRow(get().orders, updated) });
    } catch (err) {
      throw isMerchantError(err) ? err : classifyMerchantError(err);
    }
  },

  closeOrder: async (orderId, reason) => {
    try {
      const updated = await merchantRpc.closeOrder(orderId, reason);
      set({ orders: mergeRow(get().orders, updated) });
    } catch (err) {
      throw isMerchantError(err) ? err : classifyMerchantError(err);
    }
  },

  approveRefund: async (requestId, amount, note) => {
    try {
      const updated = await merchantRpc.approveRefund(requestId, amount, note);
      set({ afterSales: mergeRow(get().afterSales, updated) });
    } catch (err) {
      throw isMerchantError(err) ? err : classifyMerchantError(err);
    }
  },

  rejectRefund: async (requestId, reason) => {
    try {
      const updated = await merchantRpc.rejectRefund(requestId, reason);
      set({ afterSales: mergeRow(get().afterSales, updated) });
    } catch (err) {
      throw isMerchantError(err) ? err : classifyMerchantError(err);
    }
  },

  markRefundCompleted: async (requestId, txnId) => {
    try {
      const updated = await merchantRpc.markRefundCompleted(requestId, txnId);
      set({ afterSales: mergeRow(get().afterSales, updated) });
    } catch (err) {
      throw isMerchantError(err) ? err : classifyMerchantError(err);
    }
  },

  updateProduct: async (productId, patch) => {
    try {
      const updated = await merchantRpc.updateProduct(productId, patch);
      set({ products: mergeRow(get().products, updated) });
    } catch (err) {
      throw isMerchantError(err) ? err : classifyMerchantError(err);
    }
  },

  updateStock: async (productId, delta, reason) => {
    try {
      const updated = await merchantRpc.updateStock(productId, delta, reason);
      set({ products: mergeRow(get().products, updated) });
    } catch (err) {
      throw isMerchantError(err) ? err : classifyMerchantError(err);
    }
  },
}));
