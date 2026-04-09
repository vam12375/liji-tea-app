import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  resolveAddressUpsertParams,
  toggleFavoriteIds,
} from "@/lib/userMutations";

/** userStore 纯辅助逻辑回归测试。 */
export async function runUserMutationsTests() {
  console.log("[Suite] userMutations");

  await runCase("builds create-address rpc params from a complete draft", () => {
    const params = resolveAddressUpsertParams(null, {
      name: " 张三 ",
      phone: "13800138000",
      address: " 上海市静安区茶香路 8 号 ",
      is_default: true,
    });

    assert.deepEqual(params, {
      addressId: undefined,
      name: "张三",
      phone: "13800138000",
      address: "上海市静安区茶香路 8 号",
      makeDefault: true,
    });
  });

  await runCase("merges partial address updates with the current stored address", () => {
    const params = resolveAddressUpsertParams(
      {
        name: "李四",
        phone: "13900139000",
        address: "杭州市西湖区龙井路 1 号",
        is_default: true,
      },
      {
        address: "杭州市西湖区龙井路 2 号",
      },
      "addr-1",
    );

    assert.deepEqual(params, {
      addressId: "addr-1",
      name: "李四",
      phone: "13900139000",
      address: "杭州市西湖区龙井路 2 号",
      makeDefault: false,
    });
  });

  await runCase("rejects empty required address fields", () => {
    assert.throws(
      () =>
        resolveAddressUpsertParams(null, {
          name: "   ",
          phone: "13800138000",
          address: "上海市黄浦区茶室路 2 号",
          is_default: false,
        }),
      /收件人姓名不能为空。/,
    );
  });

  await runCase("toggleFavoriteIds appends a product when it is not favorited", () => {
    const previous = ["tea-1"];
    const result = toggleFavoriteIds(previous, "tea-2");

    assert.deepEqual(result, {
      wasFavorite: false,
      nextFavorites: ["tea-1", "tea-2"],
    });
    assert.deepEqual(previous, ["tea-1"]);
  });

  await runCase("toggleFavoriteIds removes a product when it is already favorited", () => {
    const previous = ["tea-1", "tea-2"];
    const result = toggleFavoriteIds(previous, "tea-1");

    assert.deepEqual(result, {
      wasFavorite: true,
      nextFavorites: ["tea-2"],
    });
    assert.deepEqual(previous, ["tea-1", "tea-2"]);
  });
}
