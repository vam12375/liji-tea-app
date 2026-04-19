import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { invoke } from "@/lib/merchantRpcInvoke";
import { isMerchantError, type MerchantError } from "@/lib/merchantErrors";
import {
  buildPermissionDeniedError,
  makeRpcResponse,
} from "./supabaseMock";
import type { MerchantDashboardOverview } from "@/types/database";

/**
 * 工作台聚合 RPC 的边界归一化测试：
 * - 成功路径：RPC payload 被 invoke 透传回 store。
 * - 非员工：42501 被归一为 permission_denied；merchant/index.tsx 会以该错误提示用户。
 *
 * 不覆盖 store.fetchDashboard()：store 直接引用 react-native 运行时（supabase 客户端），
 * tsx runner 无法加载；改由手动回归 + 商家账号端到端验证（见 plan 的"C 验证"章节）。
 */
async function catchError<T>(promise: Promise<T>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  assert.fail("预期抛出错误，但 invoke 成功返回。");
}

function assertMerchantError(err: unknown): MerchantError {
  assert.ok(isMerchantError(err), "预期抛出 MerchantError 结构");
  return err;
}

export async function runMerchantDashboardTests() {
  console.log("[Suite] merchantDashboard");

  await runCase("成功路径：RPC 聚合结果透传给调用方", async () => {
    const payload: MerchantDashboardOverview = {
      today_order_count: 12,
      today_gmv: 3280,
      pending_ship_count: 3,
      pending_after_sale_count: 1,
      low_stock_products: [
        { id: "p-1", name: "龙井一级", stock: 3 },
        { id: "p-2", name: "冻顶乌龙", stock: 5 },
      ],
    };

    const result = await invoke<MerchantDashboardOverview>(() =>
      makeRpcResponse({ data: payload }),
    );

    assert.equal(result.today_order_count, 12);
    assert.equal(result.today_gmv, 3280);
    assert.equal(result.pending_ship_count, 3);
    assert.equal(result.pending_after_sale_count, 1);
    assert.equal(result.low_stock_products.length, 2);
    assert.equal(result.low_stock_products[0].name, "龙井一级");
  });

  await runCase("非员工访问：42501 归类为 permission_denied", async () => {
    const err = assertMerchantError(
      await catchError(
        invoke<MerchantDashboardOverview>(() =>
          makeRpcResponse({ error: buildPermissionDeniedError() }),
        ),
      ),
    );
    assert.equal(err.kind, "permission_denied");
  });

  await runCase("空低库存列表仍然是合法返回（Array.isArray 兜底）", async () => {
    const payload: MerchantDashboardOverview = {
      today_order_count: 0,
      today_gmv: 0,
      pending_ship_count: 0,
      pending_after_sale_count: 0,
      low_stock_products: [],
    };

    const result = await invoke<MerchantDashboardOverview>(() =>
      makeRpcResponse({ data: payload }),
    );

    assert.deepEqual(result.low_stock_products, []);
  });
}
