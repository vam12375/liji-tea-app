import { create } from "zustand";

import {
  fetchMyNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRecord,
} from "@/lib/notifications";
import { logWarn } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/stores/userStore";

/** 通知中心 store：负责列表、未读数以及实时订阅的统一管理。 */
interface NotificationState {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  realtimeChannelName: string | null;
  fetchNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  startRealtime: () => void;
  stopRealtime: () => void;
}

/** 提取统一错误文案，避免各 action 重复判断异常类型。 */
function getNotificationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  realtimeChannelName: null,

  /** 同步刷新通知列表与未读数量，供通知页首屏加载使用。 */
  fetchNotifications: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      set({ notifications: [], unreadCount: 0, loading: false, error: null });
      return;
    }

    try {
      set({ loading: true, error: null });
      const [notifications, unreadCount] = await Promise.all([
        fetchMyNotifications(userId),
        fetchUnreadNotificationCount(userId),
      ]);
      set({ notifications, unreadCount, loading: false });
    } catch (error) {
      const message = getNotificationErrorMessage(error, "加载消息失败");
      logWarn("notificationStore", "fetchNotifications 失败", { error: message });
      set({ loading: false, error: message });
    }
  },

  /** 仅刷新未读数量，适合首页角标等轻量更新场景。 */
  refreshUnreadCount: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      set({ unreadCount: 0 });
      return;
    }

    try {
      const unreadCount = await fetchUnreadNotificationCount(userId);
      set({ unreadCount });
    } catch (error) {
      const message = getNotificationErrorMessage(error, "加载未读消息数量失败");
      logWarn("notificationStore", "refreshUnreadCount 失败", { error: message });
      set({ error: message });
    }
  },

  /** 标记单条通知已读，并同步更新本地列表和未读数。 */
  markAsRead: async (notificationId) => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      return;
    }

    try {
      await markNotificationAsRead(userId, notificationId);
      set((state) => {
        const notifications = state.notifications.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item,
        );
        return {
          notifications,
          unreadCount: Math.max(
            0,
            notifications.filter((item) => !item.is_read).length,
          ),
        };
      });
    } catch (error) {
      const message = getNotificationErrorMessage(error, "标记已读失败");
      logWarn("notificationStore", "markAsRead 失败", {
        notificationId,
        error: message,
      });
      set({ error: message });
    }
  },

  /** 一键全部已读，并直接把本地缓存状态切换为已读。 */
  markAllAsRead: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      return;
    }

    try {
      await markAllNotificationsAsRead(userId);
      set((state) => ({
        notifications: state.notifications.map((item) => ({
          ...item,
          is_read: true,
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      const message = getNotificationErrorMessage(error, "全部已读失败");
      logWarn("notificationStore", "markAllAsRead 失败", { error: message });
      set({ error: message });
    }
  },

  /** 建立当前用户的通知实时订阅，收到变更后自动刷新列表。 */
  startRealtime: () => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      get().stopRealtime();
      return;
    }

    const nextChannelName = `notifications:${userId}`;
    if (get().realtimeChannelName === nextChannelName) {
      return;
    }

    get().stopRealtime();

    const channel = supabase
      .channel(nextChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void get().fetchNotifications();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logWarn("notificationStore", "通知订阅状态异常", {
            userId,
            channelName: nextChannelName,
            status,
          });
        }
      });

    set({ realtimeChannelName: nextChannelName });

    void channel;
  },

  /** 关闭当前通知实时订阅，避免重复连接或页面卸载后的残留监听。 */
  stopRealtime: () => {
    const currentChannelName = get().realtimeChannelName;
    if (!currentChannelName) {
      return;
    }

    const channel = supabase
      .getChannels()
      .find((item) => item.topic === `realtime:${currentChannelName}` || item.topic === currentChannelName);

    if (channel) {
      void supabase.removeChannel(channel);
    }

    set({ realtimeChannelName: null });
  },
}));
