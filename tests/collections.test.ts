import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { findDefaultItem, mergeById } from "@/lib/collections";

/** 通用集合辅助函数回归测试。 */
export async function runCollectionsTests() {
  console.log("[Suite] collections");

  await runCase("mergeById appends only unseen items during pagination", () => {
    const merged = mergeById(
      [
        { id: "post-1", title: "第一条" },
        { id: "post-2", title: "第二条" },
      ],
      [
        { id: "post-2", title: "第二条-刷新" },
        { id: "post-3", title: "第三条" },
      ],
    );

    assert.deepEqual(merged, [
      { id: "post-1", title: "第一条" },
      { id: "post-2", title: "第二条-刷新" },
      { id: "post-3", title: "第三条" },
    ]);
  });

  await runCase("mergeById returns a mutable copy even when nothing new arrives", () => {
    const existing = [{ id: "post-1", title: "第一条" }];
    const merged = mergeById(existing, []);

    assert.notEqual(merged, existing);
    assert.deepEqual(merged, existing);
  });

  await runCase("findDefaultItem selects the current default address", () => {
    const address = findDefaultItem([
      { id: "addr-1", is_default: false, name: "茶馆" },
      { id: "addr-2", is_default: true, name: "办公室" },
    ]);

    assert.deepEqual(address, {
      id: "addr-2",
      is_default: true,
      name: "办公室",
    });
  });

  await runCase("findDefaultItem returns undefined when no default item exists", () => {
    const address = findDefaultItem([
      { id: "addr-1", is_default: false, name: "茶馆" },
    ]);

    assert.equal(address, undefined);
  });

  await runCase("findDefaultItem follows the latest default address after list refresh", () => {
    const firstDefault = findDefaultItem([
      { id: "addr-1", is_default: true, name: "茶馆" },
      { id: "addr-2", is_default: false, name: "办公室" },
    ]);
    const secondDefault = findDefaultItem([
      { id: "addr-1", is_default: false, name: "茶馆" },
      { id: "addr-2", is_default: true, name: "办公室" },
    ]);

    assert.equal(firstDefault?.id, "addr-1");
    assert.equal(secondDefault?.id, "addr-2");
  });
}
