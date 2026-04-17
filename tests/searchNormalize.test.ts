import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  expandQueryTerms,
  tokenize,
} from "../src/lib/searchNormalize";

// 搜索归一化测试：覆盖拆词、拼音映射、同义词反查与未知词回退，保证 searchProducts 扩展稳定。
export async function runSearchNormalizeTests() {
  console.log("[Suite] searchNormalize");

  await runCase("tokenize 按空格 / 中英文逗号拆分并去空白", () => {
    assert.deepEqual(tokenize("龙井 白茶"), ["龙井", "白茶"]);
    assert.deepEqual(tokenize("  龙井, 白茶 ，普洱  "), ["龙井", "白茶", "普洱"]);
    assert.deepEqual(tokenize(""), []);
    assert.deepEqual(tokenize("   "), []);
  });

  await runCase("expandQueryTerms 空串返回空数组", () => {
    assert.deepEqual(expandQueryTerms(""), []);
    assert.deepEqual(expandQueryTerms("   "), []);
  });

  await runCase("ASCII 命中拼音映射后补中文", () => {
    const terms = expandQueryTerms("longjing");
    assert.ok(terms.includes("longjing"));
    assert.ok(terms.includes("龙井"));
  });

  await runCase("拼音大小写不敏感", () => {
    const terms = expandQueryTerms("BiluoChun");
    assert.ok(terms.includes("BiluoChun"));
    assert.ok(terms.includes("碧螺春"));
  });

  await runCase("中文正名扩展到全部别名", () => {
    const terms = expandQueryTerms("龙井");
    assert.ok(terms.includes("龙井"));
    assert.ok(terms.includes("西湖龙井"));
    assert.ok(terms.includes("狮峰龙井"));
  });

  await runCase("中文别名反查到正名", () => {
    const terms = expandQueryTerms("武夷岩茶");
    assert.ok(terms.includes("武夷岩茶"));
    assert.ok(terms.includes("大红袍"));
  });

  await runCase("未知 ASCII 词保持原样不抛错", () => {
    assert.deepEqual(expandQueryTerms("unknownword"), ["unknownword"]);
  });

  await runCase("未知中文词保持原样", () => {
    assert.deepEqual(expandQueryTerms("某种不存在的茶"), ["某种不存在的茶"]);
  });

  await runCase("多 token 拼合去重", () => {
    const terms = expandQueryTerms("longjing 龙井");
    // 同一个目标中文只应出现一次。
    const longjingCount = terms.filter((term) => term === "龙井").length;
    assert.equal(longjingCount, 1);
  });
}
