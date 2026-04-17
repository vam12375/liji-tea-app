import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  extractPushNavigationData,
  resolvePushTypeFromNotification,
} from "../src/lib/pushTypes";

// 推送纯逻辑测试：覆盖 payload 提取与推送分类判定，保证 SQL / TS 两侧镜像一致。
export async function runPushNotificationsTests() {
  console.log("[Suite] pushNotifications");

  await runCase("extractPushNavigationData 对 null / undefined 全部落到 null", () => {
    assert.deepEqual(extractPushNavigationData(null), {
      notificationId: null,
      relatedType: null,
      relatedId: null,
    });
    assert.deepEqual(extractPushNavigationData(undefined), {
      notificationId: null,
      relatedType: null,
      relatedId: null,
    });
    assert.deepEqual(extractPushNavigationData({}), {
      notificationId: null,
      relatedType: null,
      relatedId: null,
    });
  });

  await runCase("extractPushNavigationData 过滤非字符串字段", () => {
    assert.deepEqual(
      extractPushNavigationData({
        notificationId: 123,
        relatedType: { type: "bad" },
        relatedId: null,
      }),
      {
        notificationId: null,
        relatedType: null,
        relatedId: null,
      },
    );
  });

  await runCase("extractPushNavigationData 合法字段原样透传", () => {
    assert.deepEqual(
      extractPushNavigationData({
        notificationId: "noti-1",
        relatedType: "post",
        relatedId: "post-9",
        extra: "ignored",
      }),
      {
        notificationId: "noti-1",
        relatedType: "post",
        relatedId: "post-9",
      },
    );
  });

  await runCase("resolvePushTypeFromNotification community 类型直接返回 community", () => {
    assert.equal(
      resolvePushTypeFromNotification("community", null),
      "community",
    );
    assert.equal(
      resolvePushTypeFromNotification("community", "post"),
      "community",
    );
  });

  await runCase(
    "resolvePushTypeFromNotification order + after_sale_request 映射到 after_sale",
    () => {
      assert.equal(
        resolvePushTypeFromNotification("order", "after_sale_request"),
        "after_sale",
      );
    },
  );

  await runCase("resolvePushTypeFromNotification order 其他关联类型降级为 order", () => {
    assert.equal(resolvePushTypeFromNotification("order", null), "order");
    assert.equal(resolvePushTypeFromNotification("order", undefined), "order");
    assert.equal(resolvePushTypeFromNotification("order", "tracking"), "order");
  });

  await runCase("resolvePushTypeFromNotification 未知类型返回 null", () => {
    assert.equal(resolvePushTypeFromNotification("review", null), null);
    assert.equal(resolvePushTypeFromNotification("system", "post"), null);
    assert.equal(resolvePushTypeFromNotification(null, null), null);
    assert.equal(resolvePushTypeFromNotification(undefined, undefined), null);
  });
}
