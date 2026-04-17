import { Text, View } from "react-native";

import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { useUserStore } from "@/stores/userStore";

// Task 5 占位：Task 8 会替换为真实订单履约列表。
export default function MerchantOrdersPlaceholder() {
  const role = useUserStore((s) => s.role);
  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="orders" showStaff={role === "admin"} />
      <View className="flex-1 items-center justify-center">
        <Text className="text-on-surface-variant">订单履约（待实现）</Text>
      </View>
    </View>
  );
}
