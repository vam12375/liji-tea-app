import { Text, View } from "react-native";

import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { useUserStore } from "@/stores/userStore";

// Task 5 占位：Task 9 会替换为真实售后处理列表。
export default function MerchantAfterSalePlaceholder() {
  const role = useUserStore((s) => s.role);
  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="after-sale" showStaff={role === "admin"} />
      <View className="flex-1 items-center justify-center">
        <Text className="text-on-surface-variant">售后处理（待实现）</Text>
      </View>
    </View>
  );
}
