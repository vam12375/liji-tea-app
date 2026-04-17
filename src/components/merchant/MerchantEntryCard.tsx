import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { isMerchantStaff, type UserRole } from "@/lib/userRole";

interface Props {
  role: UserRole;
}

// 「我的」页商家后台入口卡片。
// - 仅当 role ∈ {admin, staff} 时渲染，顾客态直接返回 null 保持原布局不变。
// - 点击跳转 /merchant/orders（商家端默认落地页，履约优先级最高）。
export function MerchantEntryCard({ role }: Props) {
  if (!isMerchantStaff(role)) return null;

  const roleLabel = role === "admin" ? "管理员" : "员工";

  return (
    <Pressable
      onPress={() => router.push("/merchant/orders" as never)}
      className="mx-4 my-1 rounded-2xl bg-primary-container px-4 py-4"
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <MaterialIcons name="storefront" size={24} color={Colors.primary} />
          <View>
            <Text className="text-on-primary-container text-base font-semibold">
              商家后台
            </Text>
            <Text className="text-on-primary-container text-xs opacity-70 mt-0.5">
              当前身份：{roleLabel} · 处理订单、售后与商品
            </Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={Colors.primary} />
      </View>
    </Pressable>
  );
}
