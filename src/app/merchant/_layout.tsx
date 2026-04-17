import { Redirect, Stack } from "expo-router";
import { View } from "react-native";

import { MerchantToast } from "@/components/merchant/MerchantToast";
import { isMerchantStaff } from "@/lib/userRole";
import { useUserStore } from "@/stores/userStore";

// 商家后台路由根布局：
// - 集中权限守卫（未登录 → login；非员工 → (tabs)）
// - 外层 View 承载全局 Toast，保证所有 /merchant/* 子页面共用同一顶部提示
// - 顶部「订单 / 售后 / 商品 / 员工」由各列表页自带的 MerchantTopTabs 承载
export default function MerchantLayout() {
  const session = useUserStore((s) => s.session);
  const role = useUserStore((s) => s.role);

  if (!session) {
    return <Redirect href="/login" />;
  }
  if (!isMerchantStaff(role)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <MerchantToast />
    </View>
  );
}
