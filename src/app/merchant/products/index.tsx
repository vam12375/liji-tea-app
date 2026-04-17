import { Text, View } from "react-native";

import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { useUserStore } from "@/stores/userStore";

// Task 5 占位：Task 10 会替换为真实商品/库存管理列表。
export default function MerchantProductsPlaceholder() {
  const role = useUserStore((s) => s.role);
  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="products" showStaff={role === "admin"} />
      <View className="flex-1 items-center justify-center">
        <Text className="text-on-surface-variant">商品/库存（待实现）</Text>
      </View>
    </View>
  );
}
