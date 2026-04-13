import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { routes, type OrdersInitialTab } from "@/lib/routes";
import { useOrderStore } from "@/stores/orderStore";

/** 状态条目定义 — 每项对应一个订单状态 */
const STATUS_ITEMS = [
  {
    icon: "payments" as const,
    label: "待付款",
    status: "pending" as const,
  },
  {
    icon: "inventory-2" as const,
    label: "待发货",
    status: "paid" as const,
  },
  {
    icon: "local-shipping" as const,
    label: "待收货",
    status: "shipping" as const,
  },
  {
    icon: "rate-review" as const,
    label: "待评价",
    status: "delivered" as const,
  },
];

export default function OrderStatusRow() {
  const router = useRouter();
  // 订单状态条只订阅订单列表和拉取动作，保留本地兜底拉取，同时避免其他订单状态变更连带重渲染。
  const orders = useOrderStore((state) => state.orders);
  const fetchOrders = useOrderStore((state) => state.fetchOrders);

  // 首次渲染时，若订单列表为空则拉取一次
  useEffect(() => {
    if (orders.length === 0) {
      void fetchOrders();
    }
  }, [fetchOrders, orders.length]);

  /** 统计某状态下的订单数量 */
  const countByStatus = (status: string) =>
    orders.filter((o) => o.status === status).length;

  return (
    <View className="bg-surface-container-low rounded-2xl mx-4 px-2 py-4 flex-row items-center">
      {STATUS_ITEMS.map((item) => {
        const badge = countByStatus(item.status);
        return (
          <Pressable
            key={item.label}
            onPress={() => router.push(routes.ordersTab(item.status as OrdersInitialTab))}
            className="flex-1 items-center gap-2 active:opacity-60"
          >
            <View className="relative">
              <MaterialIcons name={item.icon} size={24} color={Colors.onSurface} />
              {/* 仅在有订单时显示 badge */}
              {badge > 0 && (
                <View className="absolute -top-1 -right-2 bg-error w-4 h-4 rounded-full items-center justify-center">
                  <Text className="text-on-error text-[8px] font-bold">
                    {badge}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-on-surface text-[10px]">{item.label}</Text>
          </Pressable>
        );
      })}

      {/* 全部订单 */}
      <Pressable
        onPress={() => router.push(routes.orders)}
        className="flex-1 items-center gap-2 border-l border-outline-variant/20 active:opacity-60"
      >
        <MaterialIcons name="assignment" size={24} color={Colors.onSurface} />
        <Text className="text-on-surface text-[10px]">全部订单</Text>
      </Pressable>
    </View>
  );
}
