import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";

const STATUS_ITEMS = [
  { icon: "payments" as const, label: "待付款", badge: 1 },
  { icon: "inventory-2" as const, label: "待发货" },
  { icon: "local-shipping" as const, label: "待收货", route: "/tracking" as const },
  { icon: "rate-review" as const, label: "待评价" },
];

export default function OrderStatusRow() {
  const router = useRouter();

  return (
    <View className="bg-surface-container-low rounded-2xl mx-4 px-2 py-4 flex-row items-center">
      {STATUS_ITEMS.map((item) => (
        <Pressable
          key={item.label}
          onPress={item.route ? () => router.push(item.route as any) : undefined}
          className="flex-1 items-center gap-2 active:opacity-60"
        >
          <View className="relative">
            <MaterialIcons name={item.icon} size={24} color={Colors.onSurface} />
            {item.badge && (
              <View className="absolute -top-1 -right-2 bg-error w-4 h-4 rounded-full items-center justify-center">
                <Text className="text-on-error text-[8px] font-bold">
                  {item.badge}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-on-surface text-[10px]">{item.label}</Text>
        </Pressable>
      ))}
      {/* 全部订单 */}
      <Pressable className="flex-1 items-center gap-2 border-l border-outline-variant/20 active:opacity-60">
        <MaterialIcons name="assignment" size={24} color={Colors.onSurface} />
        <Text className="text-on-surface text-[10px]">全部订单</Text>
      </Pressable>
    </View>
  );
}
