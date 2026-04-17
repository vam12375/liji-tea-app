import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { interpolateCount } from "@/lib/merchantHeroStats";

/** Hero 数字 count-up 纯函数边界测试。 */
export async function runMerchantHeroStatsTests() {
  console.log("[Suite] merchantHeroStats");

  await runCase("progress=0 返回 from", () => {
    assert.equal(interpolateCount(10, 20, 0), 10);
  });
  await runCase("progress=1 返回 to", () => {
    assert.equal(interpolateCount(10, 20, 1), 20);
  });
  await runCase("progress=0.5 居中取整", () => {
    assert.equal(interpolateCount(10, 20, 0.5), 15);
  });
  await runCase("负向变化也支持", () => {
    assert.equal(interpolateCount(20, 10, 0.5), 15);
  });
  await runCase("超范围 progress 被裁剪", () => {
    assert.equal(interpolateCount(10, 20, -0.5), 10);
    assert.equal(interpolateCount(10, 20, 1.5), 20);
  });
}
