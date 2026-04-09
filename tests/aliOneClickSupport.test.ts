import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { isAliOneClickSupported } from "../modules/ali-one-login/src/support";

/** 一键登录入口可用性判断测试。 */
export async function runAliOneClickSupportTests() {
  console.log("[Suite] aliOneClickSupport");

  await runCase("allows one-click login only on android with native module", () => {
    assert.equal(
      isAliOneClickSupported({ platform: "android", hasNativeModule: true }),
      true,
    );
    assert.equal(
      isAliOneClickSupported({ platform: "android", hasNativeModule: false }),
      false,
    );
  });

  await runCase("disables one-click login on non-android platforms", () => {
    assert.equal(
      isAliOneClickSupported({ platform: "ios", hasNativeModule: true }),
      false,
    );
    assert.equal(
      isAliOneClickSupported({ platform: "web", hasNativeModule: true }),
      false,
    );
  });
}
