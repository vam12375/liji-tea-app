import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import type { Order } from "../src/types/database";
import {
  canApplyAfterSale,
  getAfterSaleReasonLabel,
  getAfterSaleStatusDescription,
  getAfterSaleStatusLabel,
  isActiveAfterSaleStatus,
} from "../src/lib/afterSaleState";

// 构造最小可用的订单对象，避免在每个用例里重复冗长字段。
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
    created_at: "2026-04-17T00:00:00Z",
    updated_at: "2026-04-17T00:00:00Z",
    ...patch,
  };
}

/** 售后域纯函数测试：保证状态机、文案映射与申请资格判断稳定。 */
export async function runAfterSaleTests() {
  console.log("[Suite] afterSale");

  await runCase("canApplyAfterSale 对空订单直接拒绝", () => {
    assert.equal(canApplyAfterSale(null), false);
    assert.equal(canApplyAfterSale(undefined), false);
  });

  await runCase("canApplyAfterSale 仅允许已支付后续状态发起", () => {
    assert.equal(canApplyAfterSale(buildOrder({ status: "paid" })), true);
    assert.equal(canApplyAfterSale(buildOrder({ status: "shipping" })), true);
    assert.equal(canApplyAfterSale(buildOrder({ status: "delivered" })), true);
    assert.equal(canApplyAfterSale(buildOrder({ status: "pending" })), false);
    assert.equal(canApplyAfterSale(buildOrder({ status: "cancelled" })), false);
  });

  await runCase("canApplyAfterSale 在已有售后状态或已退款时拒绝", () => {
    assert.equal(
      canApplyAfterSale(
        buildOrder({ status: "paid", after_sale_status: "submitted" }),
      ),
      false,
    );
    assert.equal(
      canApplyAfterSale(
        buildOrder({ status: "paid", refund_status: "refunded" }),
      ),
      false,
    );
    // refund_status 为非终态（refunding）时不应阻断 — after_sale_status 为空才允许。
    assert.equal(
      canApplyAfterSale(
        buildOrder({ status: "paid", refund_status: "refunding" }),
      ),
      true,
    );
  });

  await runCase("isActiveAfterSaleStatus 只在处理中状态返回 true", () => {
    const activeStatuses = [
      "submitted",
      "auto_approved",
      "pending_review",
      "approved",
      "refunding",
    ] as const;
    for (const status of activeStatuses) {
      assert.equal(isActiveAfterSaleStatus(status), true);
    }

    const terminalStatuses = ["rejected", "refunded", "cancelled"] as const;
    for (const status of terminalStatuses) {
      assert.equal(isActiveAfterSaleStatus(status), false);
    }

    assert.equal(isActiveAfterSaleStatus(null), false);
    assert.equal(isActiveAfterSaleStatus(undefined), false);
  });

  await runCase("getAfterSaleStatusLabel 覆盖全部已知状态与 fallback", () => {
    assert.equal(getAfterSaleStatusLabel("submitted"), "已提交");
    assert.equal(getAfterSaleStatusLabel("auto_approved"), "自动通过");
    assert.equal(getAfterSaleStatusLabel("pending_review"), "待审核");
    assert.equal(getAfterSaleStatusLabel("approved"), "审核通过");
    assert.equal(getAfterSaleStatusLabel("rejected"), "已拒绝");
    assert.equal(getAfterSaleStatusLabel("refunding"), "退款中");
    assert.equal(getAfterSaleStatusLabel("refunded"), "已退款");
    assert.equal(getAfterSaleStatusLabel("cancelled"), "已撤销");
    assert.equal(getAfterSaleStatusLabel(null), "待处理");
    assert.equal(getAfterSaleStatusLabel(undefined), "待处理");
  });

  await runCase("getAfterSaleStatusDescription 覆盖全部已知状态与 fallback", () => {
    assert.match(getAfterSaleStatusDescription("auto_approved"), /自动通过/);
    assert.match(getAfterSaleStatusDescription("pending_review"), /人工审核/);
    assert.match(getAfterSaleStatusDescription("approved"), /审核已通过/);
    assert.match(getAfterSaleStatusDescription("rejected"), /审核说明/);
    assert.match(getAfterSaleStatusDescription("refunding"), /退款处理中/);
    assert.match(getAfterSaleStatusDescription("refunded"), /退款已完成/);
    assert.match(getAfterSaleStatusDescription("cancelled"), /已撤销/);
    assert.match(getAfterSaleStatusDescription("submitted"), /申请已提交/);
    assert.equal(getAfterSaleStatusDescription(null), "状态同步中。");
    assert.equal(getAfterSaleStatusDescription(undefined), "状态同步中。");
  });

  await runCase("getAfterSaleReasonLabel 回退到 code 而不是空字符串", () => {
    assert.equal(getAfterSaleReasonLabel("wrong_item"), "商品拍错 / 下错单");
    assert.equal(getAfterSaleReasonLabel("delay"), "发货慢 / 不想等了");
    assert.equal(getAfterSaleReasonLabel("damaged"), "包装破损 / 商品异常");
    assert.equal(getAfterSaleReasonLabel("quality_issue"), "品质问题");
    assert.equal(getAfterSaleReasonLabel("other"), "其他原因");
    // 未知 code 要回退到原始字符串，避免 UI 丢数据。
    assert.equal(getAfterSaleReasonLabel("__unknown__"), "__unknown__");
    assert.equal(getAfterSaleReasonLabel(null), "--");
    assert.equal(getAfterSaleReasonLabel(undefined), "--");
    assert.equal(getAfterSaleReasonLabel(""), "--");
  });
}
