import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  dismissMerchantToast,
  getMerchantToastState,
  pushMerchantToast,
  resetMerchantToastStore,
} from "@/stores/merchantToastStore";

/** 商家端 Toast 单 slot 状态机测试。 */
export async function runMerchantToastTests() {
  console.log("[Suite] merchantToast");

  await runCase("初始态无消息", () => {
    resetMerchantToastStore();
    assert.equal(getMerchantToastState().current, null);
  });

  await runCase("push 成功消息后 current 可读", () => {
    resetMerchantToastStore();
    pushMerchantToast({ kind: "success", title: "发货成功", detail: "LJ-001" });
    const state = getMerchantToastState();
    assert.equal(state.current?.kind, "success");
    assert.equal(state.current?.title, "发货成功");
    assert.equal(state.current?.detail, "LJ-001");
  });

  await runCase("dismiss 后 current 清空", () => {
    resetMerchantToastStore();
    pushMerchantToast({ kind: "error", title: "失败" });
    dismissMerchantToast();
    assert.equal(getMerchantToastState().current, null);
  });

  await runCase("连续 push 替换上一条（单 slot）", () => {
    resetMerchantToastStore();
    pushMerchantToast({ kind: "success", title: "一" });
    const firstId = getMerchantToastState().current?.id;
    pushMerchantToast({ kind: "success", title: "二" });
    const secondState = getMerchantToastState();
    assert.equal(secondState.current?.title, "二");
    assert.notEqual(secondState.current?.id, firstId);
  });
}
