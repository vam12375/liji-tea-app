import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { invoke } from "@/lib/merchantRpcInvoke";
import { isMerchantError, type MerchantError } from "@/lib/merchantErrors";
import {
  buildInvalidInputError,
  buildNotFoundError,
  buildPermissionDeniedError,
  buildStateConflictError,
  makeRpcRejection,
  makeRpcResponse,
} from "./supabaseMock";

/** 以未知类型接住 invoke 的异常后做类型收窄，避免 any。 */
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

/** 商家端 RPC invoke 包装器：覆盖成功 / 归一化错误 / null data / 已归一化透传 / 异步 reject。 */
export async function runMerchantRpcInvokeTests() {
  console.log("[Suite] merchantRpcInvoke");

  await runCase("成功路径：thenable 返回 data 时直接透传", async () => {
    const result = await invoke<{ id: string }>(() =>
      makeRpcResponse({ data: { id: "order-1" } }),
    );
    assert.deepEqual(result, { id: "order-1" });
  });

  await runCase("42501 权限错误归类为 permission_denied", async () => {
    const err = assertMerchantError(
      await catchError(
        invoke(() => makeRpcResponse({ error: buildPermissionDeniedError() })),
      ),
    );
    assert.equal(err.kind, "permission_denied");
    assert.equal(err.message, "无权限执行该操作");
  });

  await runCase("state_conflict 归类为 state_conflict 并保留原因", async () => {
    const err = assertMerchantError(
      await catchError(
        invoke(() =>
          makeRpcResponse({
            error: buildStateConflictError("order status must be paid, got shipping"),
          }),
        ),
      ),
    );
    assert.equal(err.kind, "state_conflict");
    assert.ok(err.message.includes("paid"));
  });

  await runCase("not_found 归类为 not_found", async () => {
    const err = assertMerchantError(
      await catchError(
        invoke(() =>
          makeRpcResponse({ error: buildNotFoundError("order not_found") }),
        ),
      ),
    );
    assert.equal(err.kind, "not_found");
  });

  await runCase("invalid_input 归类为 invalid_input 并保留正文", async () => {
    const err = assertMerchantError(
      await catchError(
        invoke(() =>
          makeRpcResponse({
            error: buildInvalidInputError("carrier/tracking_no required"),
          }),
        ),
      ),
    );
    assert.equal(err.kind, "invalid_input");
    assert.ok(err.message.includes("carrier"));
  });

  await runCase("data 为 null 时抛 unknown + 固定文案", async () => {
    const err = assertMerchantError(
      await catchError(invoke(() => makeRpcResponse({ data: null }))),
    );
    assert.equal(err.kind, "unknown");
    assert.equal(err.message, "服务端未返回结果");
  });

  await runCase("data 为 undefined 时同样抛 unknown", async () => {
    const err = assertMerchantError(
      await catchError(invoke(() => makeRpcResponse({ data: undefined }))),
    );
    assert.equal(err.kind, "unknown");
    assert.equal(err.message, "服务端未返回结果");
  });

  await runCase("thenable reject（如网络异常）被 classify 为 unknown", async () => {
    const err = assertMerchantError(
      await catchError(invoke(() => makeRpcRejection(new Error("network timeout")))),
    );
    assert.equal(err.kind, "unknown");
    assert.ok(err.message.includes("network"));
  });

  await runCase("已归一化 MerchantError 原样透传（不二次 classify）", async () => {
    // 用户手动抛一个带 kind 的对象：invoke 应透传而不是包成 unknown。
    const preclassified: MerchantError = {
      kind: "state_conflict",
      message: "自定义状态冲突",
      raw: "raw",
    };
    const err = assertMerchantError(
      await catchError(invoke(() => makeRpcRejection(preclassified))),
    );
    assert.equal(err.kind, "state_conflict");
    assert.equal(err.message, "自定义状态冲突");
  });
}
