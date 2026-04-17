import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { Colors } from "@/constants/Colors";
import type { NotificationRecord } from "@/lib/notifications";
import { groupNotificationsByType } from "@/lib/notifications";
import { routes } from "@/lib/routes";
import { useNotificationStore } from "@/stores/notificationStore";
import { useUserStore } from "@/stores/userStore";

/** 通知中心顶部分类标签，和通知类型一一对应。 */
const TABS = [
  { key: "all", label: "全部" },
  { key: "order", label: "订单" },
  { key: "system", label: "系统" },
  { key: "community", label: "社区" },
  { key: "review", label: "评价" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** 各类通知对应的图标与强调色，统一消息卡片视觉风格。 */
const ICON_MAP = {
  order: { icon: "receipt-long", color: "#f97316" },
  system: { icon: "campaign", color: Colors.primary },
  community: { icon: "forum", color: Colors.tertiary },
  review: { icon: "rate-review", color: Colors.secondary },
} as const;

/**
 * 按通知关联资源跳转到对应页面。
 * 优先使用 related_type / related_id，其次从 metadata 中补充必要参数。
 */
function handleNotificationNavigation(item: NotificationRecord) {
  if (item.related_type === "order" && item.related_id) {
    router.push(routes.tracking(item.related_id));
    return;
  }

  if (item.related_type === "after_sale_request" && item.related_id) {
    router.push(routes.afterSaleDetail(item.related_id));
    return;
  }

  if (item.related_type === "product_review") {
    const productId =
      typeof item.metadata?.product_id === "string" ? item.metadata.product_id : null;

    if (productId) {
      router.push(routes.product(productId));
      return;
    }

    router.push(routes.myReviews);
    return;
  }

  if (item.related_type === "post" && item.related_id) {
    router.push(routes.post(item.related_id));
    return;
  }

  if (item.related_type === "article" && item.related_id) {
    router.push(routes.article(item.related_id));
    return;
  }

  if (item.related_type === "coupon") {
    router.push(routes.coupons);
    return;
  }

  if (item.related_type === "favorite") {
    router.push(routes.favorites);
    return;
  }

  router.push(routes.notifications);
}

export default function NotificationsScreen() {
  const session = useUserStore((state) => state.session);
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.loading);
  const error = useNotificationStore((state) => state.error);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const startRealtime = useNotificationStore((state) => state.startRealtime);
  const stopRealtime = useNotificationStore((state) => state.stopRealtime);

  const [activeTab, setActiveTab] = useState<TabKey>("all");

  /**
   * 登录后立即拉取通知列表并开启实时订阅。
   * 退出登录或页面卸载时需要主动关闭订阅，避免重复连接。
   */
  useEffect(() => {
    if (!session?.user?.id) {
      stopRealtime();
      return;
    }

    void fetchNotifications();
    startRealtime();

    return () => {
      stopRealtime();
    };
  }, [fetchNotifications, session?.user?.id, startRealtime, stopRealtime]);

  /** 先按类型分组，再根据当前 Tab 取出当前可见列表。 */
  const grouped = useMemo(() => groupNotificationsByType(notifications), [notifications]);
  const currentItems = grouped[activeTab];

  if (!session) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="消息通知" />
        <ScreenState
          variant="empty"
          title="登录后查看消息"
          description="订单提醒、社区互动和评价通知都会在这里汇总。"
          icon="notifications-none"
        />
      </View>
    );
  }

  if (loading && notifications.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="消息通知" />
        <ScreenState variant="loading" title="正在加载消息..." />
      </View>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="消息通知" />
        <ScreenState
          variant="error"
          title="消息加载失败"
          description={error}
          actionLabel="重试"
          onAction={() => void fetchNotifications()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="消息通知" />

      <View className="px-4 pt-3 pb-2 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-on-surface text-sm">
            未读 <Text className="text-primary font-bold">{unreadCount}</Text>
          </Text>
          <Pressable onPress={() => void markAllAsRead()} hitSlop={8}>
            <Text className="text-primary text-sm font-medium">全部已读</Text>
          </Pressable>
        </View>

        <View className="flex-row bg-surface-container-low rounded-full p-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`flex-1 rounded-full py-2.5 items-center ${active ? "bg-primary-container" : ""}`}
              >
                <Text className={active ? "text-on-primary font-medium" : "text-on-surface-variant"}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={currentItems}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8 gap-3"
        renderItem={({ item }) => {
          const iconConfig = ICON_MAP[item.type];
          return (
            <Pressable
              onPress={() => {
                // 点击未读消息时先尝试本地/远端标记已读，再执行页面跳转。
                if (!item.is_read) {
                  void markAsRead(item.id);
                }
                handleNotificationNavigation(item);
              }}
              className={`bg-surface-container-low rounded-2xl p-4 gap-2 ${!item.is_read ? "border-l-4 border-primary" : ""}`}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-9 h-9 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${iconConfig.color}20` }}
                >
                  <MaterialIcons
                    name={iconConfig.icon as keyof typeof MaterialIcons.glyphMap}
                    size={18}
                    color={iconConfig.color}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-on-surface text-sm font-medium">{item.title}</Text>
                  <Text className="text-outline text-[10px]">
                    {new Date(item.created_at).toLocaleString("zh-CN")}
                  </Text>
                </View>
                {!item.is_read ? <View className="w-2 h-2 rounded-full bg-primary" /> : null}
              </View>
              <Text className="text-on-surface-variant text-xs leading-5 pl-12">
                {item.message}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <ScreenState
            variant="empty"
            title="暂无消息"
            description="订单动态、评价结果和社区提醒会优先出现在这里。"
            icon="notifications-none"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
