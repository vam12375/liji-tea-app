import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import { routes } from "../src/lib/routes";

/** 简化版签到判定辅助函数，用于验证“今日已完成”逻辑。 */
function isTaskCompletedToday(
  taskCode: string,
  records: Array<{ task_code: string; task_date: string | null }>,
) {
  const today = new Date().toISOString().slice(0, 10);
  return records.some(
    (record) => record.task_code === taskCode && record.task_date === today,
  );
}

/** 会员积分与任务路由相关测试。 */
export async function runMemberPointsTests() {
  console.log("[Suite] memberPoints");

  await runCase("points route points to积分明细页", () => {
    assert.equal(routes.points, "/points");
  });

  await runCase("product reviews route still keeps productId filter", () => {
    assert.deepEqual(routes.productReviews("tea-1"), {
      pathname: "/my-reviews",
      params: { productId: "tea-1", initialTab: "已评价" },
    });
  });

  await runCase("daily check-in helper detects today's record", () => {
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(
      isTaskCompletedToday("daily_check_in", [
        { task_code: "daily_check_in", task_date: today },
      ]),
      true,
    );
    assert.equal(
      isTaskCompletedToday("daily_check_in", [
        { task_code: "first_review", task_date: today },
      ]),
      false,
    );
  });
}
