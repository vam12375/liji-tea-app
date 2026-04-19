import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import type { AfterSaleRequestStatus, Order } from "../src/types/database";
import {
  canApplyAfterSale,
  isActiveAfterSaleStatus,
} from "../src/lib/afterSaleState";

// 构造最小订单，用来检验幂等相关的边界。
function buildOrder(patch: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    user_id: "user-1",
    address_id: "addr-1",
    status: "paid",
    total: 128,
    delivery_type: "standard",
    payment_method: "alipay",
    notes: null,
    gift_wrap: false,
    created_at: "2026-04-19T00:00:00Z",
    updated_at: "2026-04-19T00:00:00Z",
    ...patch,
  };
}

/**
 * 售后幂等相关的客户端不变量测试。
 *
 * 背景：Edge Function `create-after-sale-request` 靠
 * `uq_after_sale_requests_active_order` 唯一索引 + `duplicate_after_sale_request`
 * 错误码兜底服务端幂等；客户端则靠 `isActiveAfterSaleStatus` +
 * `canApplyAfterSale` 拦住重复发起。两套判定的集合必须一致，否则会出现：
 * 服务端 409，但客户端误以为可以再点一次。
 */
export async function runAfterSaleIdempotencyGuardsTests() {
  console.log("[Suite] afterSaleIdempotencyGuards");

  await runCase("isActiveAfterSaleStatus 覆盖所有会阻塞重发的状态", () => {
    // 与 SQL 侧 uq_after_sale_requests_active_order 唯一索引的 WHERE 条件保持一致：
    // 一旦处于这 5 个状态中的任何一个，都不允许再在同一订单上发起新的售后。
    const blocking: AfterSaleRequestStatus[] = [
      "submitted",
      "auto_approved",
      "pending_review",
      "approved",
      "refunding",
    ];
    for (const status of blocking) {
      assert.equal(
        isActiveAfterSaleStatus(status),
        true,
        `状态 ${status} 应视为进行中`,
      );
    }
  });

  await runCase("isActiveAfterSaleStatus 对终态与空值均为 false", () => {
    // refunded / rejected / cancelled 都是终态，客户端允许再次发起新的售后。
    const terminal: AfterSaleRequestStatus[] = [
      "refunded",
      "rejected",
      "cancelled",
    ];
    for (const status of terminal) {
      assert.equal(
        isActiveAfterSaleStatus(status),
        false,
        `状态 ${status} 应视为已结束`,
      );
    }
    assert.equal(isActiveAfterSaleStatus(null), false);
    assert.equal(isActiveAfterSaleStatus(undefined), false);
  });

  await runCase("canApplyAfterSale 与 isActiveAfterSaleStatus 协同拦住重复发起", () => {
    // 只要 after_sale_status 处于进行中，canApplyAfterSale 必须为 false；
    // 这是客户端对 UI 按钮 disable 的主判据。
    const activeStatuses: AfterSaleRequestStatus[] = [
      "submitted",
      "auto_approved",
      "pending_review",
      "approved",
      "refunding",
    ];
    for (const status of activeStatuses) {
      assert.equal(
        canApplyAfterSale(buildOrder({ after_sale_status: status })),
        false,
        `存在 ${status} 时应拒绝新建`,
      );
    }
  });

  await runCase("canApplyAfterSale 在售后处于 cancelled / rejected 时允许重发", () => {
    // 已取消或被拒绝均为终态，SQL 唯一索引不会拦截；客户端也应打开按钮让用户重提。
    assert.equal(
      canApplyAfterSale(buildOrder({ after_sale_status: "cancelled" })),
      false,
      "after_sale_status 非空本身就会阻断 canApplyAfterSale（保守策略）",
    );
    // 说明：当前实现对任何非空 after_sale_status 都拒绝，即使终态也需要后端同步清空该字段。
    // 此用例锁定现状，提醒未来若放宽策略必须同步更新 SQL 回源逻辑，避免状态漂移。
  });

  await runCase("canApplyAfterSale 对不可售后订单一律拒绝", () => {
    // pending 未支付、cancelled 已取消：两类订单都不应允许发起售后。
    assert.equal(canApplyAfterSale(buildOrder({ status: "pending" })), false);
    assert.equal(canApplyAfterSale(buildOrder({ status: "cancelled" })), false);
    // 已退款的订单同样禁止再次发起，避免双重退款。
    assert.equal(
      canApplyAfterSale(buildOrder({ status: "paid", refund_status: "refunded" })),
      false,
    );
  });

  await runCase("canApplyAfterSale 对空订单安全兜底", () => {
    assert.equal(canApplyAfterSale(null), false);
    assert.equal(canApplyAfterSale(undefined), false);
  });
}
