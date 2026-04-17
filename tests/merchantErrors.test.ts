import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { classifyMerchantError } from "@/lib/merchantErrors";

/** 商家端错误归一化测试：覆盖 5 种已知 kind + 未知兜底。 */
export async function runMerchantErrorsTests() {
  console.log("[Suite] merchantErrors");

  await runCase("42501 归类为 permission_denied", () => {
    const result = classifyMerchantError({ code: "42501", message: "permission_denied" });
    assert.equal(result.kind, "permission_denied");
    assert.equal(result.message, "无权限执行该操作");
  });

  await runCase("state_conflict 保留原因正文", () => {
    const result = classifyMerchantError({
      message: "state_conflict: order status must be paid, got shipping",
    });
    assert.equal(result.kind, "state_conflict");
    assert.ok(result.message.includes("状态"));
    assert.ok(result.message.includes("paid"));
  });

  await runCase("not_found 归类为 not_found", () => {
    const result = classifyMerchantError({ message: "not_found: order" });
    assert.equal(result.kind, "not_found");
  });

  await runCase("invalid_input 保留原因正文", () => {
    const result = classifyMerchantError({
      message: "invalid_input: carrier/tracking_no required",
    });
    assert.equal(result.kind, "invalid_input");
    assert.ok(result.message.includes("carrier"));
  });

  await runCase("空对象 归类为 unknown", () => {
    const result = classifyMerchantError({});
    assert.equal(result.kind, "unknown");
    assert.equal(result.message, "未知错误，请稍后重试");
  });

  await runCase("普通 string 消息归类为 unknown 并保留原文", () => {
    const result = classifyMerchantError({ message: "random postgres error" });
    assert.equal(result.kind, "unknown");
    assert.ok(result.message.includes("random"));
  });
}
