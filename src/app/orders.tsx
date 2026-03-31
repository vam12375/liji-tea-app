import { Colors } from "@/constants/Colors";
import { useOrderStore } from "@/stores/orderStore";
import type { Order } from "@/types/database";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";

/** 标签页定义 */
const TABS = [
  { key: "全部", status: null },
  { key: "待付款", status: "pending" as const },
  { key: "待发货", status: "paid" as const },
  { key: "待收货", status: "shipping" as const },
  { key: "已完成", status: "delivered" as const },
];

/** 状态映射 → initialTab 参数转换为标签 key */
const STATUS_TO_TAB: Record<string, string> = {
  pending: "待付款",
  paid: "待发货",
  shipping: "待收货",
  delivered: "已完成",
};

/** 状态徽章配置：文本 + 颜色 */
const STATUS_BADGE: Record<
  Order["status"],
  { label: string; color: string; bg: string }
> = {
  pending: { label: "待付款", color: "#f97316", bg: "#fff7ed" },
  paid: { label: "待发货", color: "#3b82f6", bg: "#eff6ff" },
  shipping: { label: "运输中", color: Colors.primary, bg: "#f0fdf4" },
  delivered: { label: "已完成", color: "#6b7280", bg: "#f3f4f6" },
  cancelled: { label: "已取消", color: "#ef4444", bg: "#fef2f2" },
};

/** 格式化时间：2026-03-20T14:32:00 → 2026-03-20 14:32 */
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PENDING_ORDER_EXPIRE_MS = 10 * 60 * 1000;

function getPendingPaymentDeadline(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return null;
  }

  return createdTime + PENDING_ORDER_EXPIRE_MS;
}

function formatRemainingPaymentTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { initialTab } = useLocalSearchParams<{ initialTab?: string }>();

  // 根据 initialTab 参数决定初始选中标签
  const [activeTab, setActiveTab] = useState(
    initialTab ? (STATUS_TO_TAB[initialTab] ?? "全部") : "全部",
  );

  const { orders, loading, fetchOrders } = useOrderStore();
  const [now, setNow] = useState(() => Date.now());

  // 挂载时拉取订单
  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 按当前标签过滤订单
  const activeTabDef = TABS.find((t) => t.key === activeTab)!;
  const filteredOrders = activeTabDef.status
    ? orders.filter((o) => o.status === activeTabDef.status)
    : orders;

  /** 渲染单个订单卡片 */
  const renderOrder = useCallback(
    ({ item }: { item: Order }) => {
      const badge = STATUS_BADGE[item.status];
      const itemCount =
        item.order_items?.reduce((sum, oi) => sum + oi.quantity, 0) ?? 0;
      const paymentDeadline =
        item.status === "pending"
          ? getPendingPaymentDeadline(item.created_at)
          : null;
      const remainingMs =
        paymentDeadline === null ? null : paymentDeadline - now;
      const isPayable =
        item.status === "pending" && remainingMs !== null && remainingMs > 0;
      const remainingText =
        isPayable && remainingMs !== null
          ? formatRemainingPaymentTime(remainingMs)
          : null;

      return (
        <Pressable
          onPress={() => router.push(`/tracking?orderId=${item.id}` as any)}
          className="bg-surface-container-low rounded-2xl mx-4 p-4 gap-3 active:opacity-80"
        >
          {/* 顶部：订单号 + 状态徽章 */}
          <View className="flex-row items-center justify-between">
            <Text className="text-on-surface text-sm font-medium">
              订单号：{item.id.slice(0, 8)}
            </Text>
            <View
              style={{ backgroundColor: badge.bg }}
              className="px-2 py-0.5 rounded-full"
            >
              <Text
                style={{ color: badge.color }}
                className="text-xs font-medium"
              >
                {badge.label}
              </Text>
            </View>
          </View>

          {/* 创建日期 */}
          <Text className="text-outline text-xs">
            {formatDate(item.created_at)}
          </Text>

          {item.status === "pending" ? (
            <View className="rounded-xl bg-background px-3 py-3 gap-1">
              <Text className="text-on-surface text-sm font-medium">
                {isPayable && remainingText
                  ? `请在 ${remainingText} 内完成支付`
                  : "订单支付已超时，系统正在自动取消"}
              </Text>
              <Text className="text-outline text-xs leading-5">
                待付款订单会在下单 10 分钟后自动关闭，超时后将无法继续支付。
              </Text>
            </View>
          ) : null}

          {/* 底部：商品件数 + 金额 */}
          <View className="flex-row items-center justify-between">
            <Text className="text-outline text-xs">共 {itemCount} 件商品</Text>
            <Text className="text-primary text-base font-bold">
              ¥{item.total.toFixed(2)}
            </Text>
          </View>

          {item.status === "pending" ? (
            <View className="flex-row justify-end">
              <Pressable
                onPress={() =>
                  router.push(
                    `/payment?orderId=${item.id}&total=${item.total}&paymentMethod=${item.payment_method ?? "alipay"}` as any,
                  )
                }
                disabled={!isPayable}
                className={`rounded-full px-5 py-2.5 ${isPayable ? "bg-primary-container active:bg-primary" : "bg-surface"}`}
              >
                <Text
                  className={`font-medium ${isPayable ? "text-on-primary" : "text-outline"}`}
                >
                  立即付款
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      );
    },
    [now, router],
  );

  return (
    <View className="flex-1 bg-background">
      {/* 导航栏 */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "我的订单",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={Colors.onSurface}
              />
            </Pressable>
          ),
        }}
      />

      {/* 顶部标签栏 */}
      <View className="flex-row border-b border-outline-variant/15 px-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-1 items-center py-3"
            >
              <Text
                className={`text-sm ${isActive ? "font-bold" : "font-normal"}`}
                style={{ color: isActive ? Colors.primary : Colors.outline }}
              >
                {tab.key}
              </Text>
              {/* 底部指示器 */}
              {isActive && (
                <View
                  className="absolute bottom-0 w-8 h-0.5 rounded-full"
                  style={{ backgroundColor: Colors.primary }}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 订单列表 / 加载态 / 空态 */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3">
          <MaterialIcons
            name="receipt-long"
            size={56}
            color={Colors.outlineVariant}
          />
          <Text className="text-outline text-sm">暂无相关订单</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerClassName="py-4 gap-3"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
