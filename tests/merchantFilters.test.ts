import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  filterMerchantAfterSales,
  filterMerchantOrders,
  filterMerchantProducts,
} from "@/lib/merchantFilters";
import type { AfterSaleRequest, Order, Product } from "@/types/database";

/** 商家端列表筛选纯函数测试。 */
export async function runMerchantFiltersTests() {
  console.log("[Suite] merchantFilters");

  const orders = [
    { id: "o1", status: "paid",      order_no: "A001", created_at: "2026-04-17T10:00:00Z" },
    { id: "o2", status: "shipping",  order_no: "A002", created_at: "2026-04-17T09:00:00Z" },
    { id: "o3", status: "paid",      order_no: "A003", created_at: "2026-04-17T11:00:00Z" },
    { id: "o4", status: "cancelled", order_no: "B100", created_at: "2026-04-16T10:00:00Z" },
  ] as unknown as Order[];

  await runCase("订单：pending_ship 聚合 paid，按时间倒序", () => {
    const result = filterMerchantOrders(orders, { status: "pending_ship", keyword: "" });
    assert.deepEqual(result.map((o) => o.id), ["o3", "o1"]);
  });

  await runCase("订单：关键字模糊匹配 order_no", () => {
    const result = filterMerchantOrders(orders, { status: "all", keyword: "b10" });
    assert.deepEqual(result.map((o) => o.id), ["o4"]);
  });

  await runCase("订单：空关键字走全量筛选", () => {
    const result = filterMerchantOrders(orders, { status: "shipping", keyword: "" });
    assert.deepEqual(result.map((o) => o.id), ["o2"]);
  });

  const afterSales = [
    { id: "r1", status: "submitted" },
    { id: "r2", status: "pending_review" },
    { id: "r3", status: "approved" },
    { id: "r4", status: "rejected" },
    { id: "r5", status: "refunded" },
  ] as unknown as AfterSaleRequest[];

  await runCase("售后：pending 聚合 submitted/pending_review/auto_approved", () => {
    const result = filterMerchantAfterSales(afterSales, { status: "pending" });
    assert.deepEqual(result.map((r) => r.id).sort(), ["r1", "r2"]);
  });

  await runCase("售后：approved 精准匹配", () => {
    const result = filterMerchantAfterSales(afterSales, { status: "approved" });
    assert.deepEqual(result.map((r) => r.id), ["r3"]);
  });

  const products = [
    { id: "p1", name: "龙井", stock: 3,  is_active: true },
    { id: "p2", name: "普洱", stock: 50, is_active: true },
    { id: "p3", name: "铁观音", stock: 0, is_active: false },
    { id: "p4", name: "白牡丹", stock: 20, is_active: false },
  ] as unknown as Product[];

  await runCase("商品：低库存筛选（含已下架）", () => {
    const result = filterMerchantProducts(products, { scope: "low_stock", keyword: "" });
    assert.deepEqual(result.map((p) => p.id).sort(), ["p1", "p3"]);
  });

  await runCase("商品：已上架筛选 + 名称关键字", () => {
    const result = filterMerchantProducts(products, { scope: "active", keyword: "龙" });
    assert.deepEqual(result.map((p) => p.id), ["p1"]);
  });

  await runCase("商品：已下架筛选", () => {
    const result = filterMerchantProducts(products, { scope: "inactive", keyword: "" });
    assert.deepEqual(result.map((p) => p.id).sort(), ["p3", "p4"]);
  });
}
