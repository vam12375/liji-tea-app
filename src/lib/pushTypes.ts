// 推送纯逻辑模块：不引入 expo-notifications / react-native 副作用，
// 便于在 Node 测试环境直接导入，也方便 SQL 侧触发器镜像同步。

export type PushType = "order" | "after_sale" | "community";

export interface PushNavigationData {
  notificationId: string | null;
  relatedType: string | null;
  relatedId: string | null;
}

// 与 SQL 函数 public.resolve_push_type_from_notification 保持 1:1 镜像：
// 任何一侧改动都要同步另一侧，并通过 tests/pushNotifications.test.ts 回归。
export function resolvePushTypeFromNotification(
  type: string | null | undefined,
  relatedType: string | null | undefined,
): PushType | null {
  if (type === "community") {
    return "community";
  }

  if (type === "order" && relatedType === "after_sale_request") {
    return "after_sale";
  }

  if (type === "order") {
    return "order";
  }

  return null;
}

// 从推送 payload 的 data 字段中安全提取路由所需字段，非字符串一律落到 null。
export function extractPushNavigationData(
  data: Record<string, unknown> | null | undefined,
): PushNavigationData {
  return {
    notificationId:
      typeof data?.notificationId === "string" ? data.notificationId : null,
    relatedType:
      typeof data?.relatedType === "string" ? data.relatedType : null,
    relatedId: typeof data?.relatedId === "string" ? data.relatedId : null,
  };
}
