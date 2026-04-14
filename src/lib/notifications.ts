import { supabase } from "@/lib/supabase";
import type { AppNotification, NotificationType } from "@/types/database";

/** 通知列表查询字段，保持页面与 store 读取结构一致。 */
export const NOTIFICATION_SELECT = `
  id,
  user_id,
  type,
  title,
  message,
  related_type,
  related_id,
  metadata,
  is_read,
  created_at,
  updated_at
`;

export type NotificationRecord = AppNotification;

/** 拉取当前用户最近的通知列表，按创建时间倒序返回。 */
export async function fetchMyNotifications(userId: string): Promise<NotificationRecord[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message || "加载消息失败");
  }

  return (data ?? []) as NotificationRecord[];
}

/** 单独查询未读数量，便于首页角标等轻量场景快速刷新。 */
export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(error.message || "加载未读消息数量失败");
  }

  return count ?? 0;
}

/** 将单条通知标记为已读，同时刷新 updated_at 便于审计。 */
export async function markNotificationAsRead(userId: string, notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "标记已读失败");
  }
}

/** 将当前用户所有未读通知批量标记为已读。 */
export async function markAllNotificationsAsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(error.message || "全部已读失败");
  }
}

/** 按通知类型构造 Tab 数据源，all 保留完整列表以供“全部”标签使用。 */
export function groupNotificationsByType(items: NotificationRecord[]) {
  const grouped: Record<NotificationType | "all", NotificationRecord[]> = {
    all: items,
    order: [],
    system: [],
    community: [],
    review: [],
  };

  for (const item of items) {
    grouped[item.type].push(item);
  }

  return grouped;
}
