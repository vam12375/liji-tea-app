import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { normalizeUserRole } from "@/lib/userRole";

/** 商家角色归一化测试：覆盖 null / admin / staff / 未知四种输入。 */
export async function runUserRoleTests() {
  console.log("[Suite] userRole");

  await runCase("null row 归一化为 guest", () => {
    assert.equal(normalizeUserRole(null), "guest");
  });

  await runCase("undefined row 归一化为 guest", () => {
    assert.equal(normalizeUserRole(undefined), "guest");
  });

  await runCase("admin row 归一化为 admin", () => {
    assert.equal(normalizeUserRole({ role: "admin" }), "admin");
  });

  await runCase("staff row 归一化为 staff", () => {
    assert.equal(normalizeUserRole({ role: "staff" }), "staff");
  });

  await runCase("未知 role 兜底为 guest", () => {
    assert.equal(normalizeUserRole({ role: "super" }), "guest");
  });

  await runCase("role 大小写不敏感", () => {
    assert.equal(normalizeUserRole({ role: "ADMIN" }), "admin");
    assert.equal(normalizeUserRole({ role: " Staff " }), "staff");
  });
}
