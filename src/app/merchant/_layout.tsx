import { Redirect, Stack } from "expo-router";

import { isMerchantStaff } from "@/lib/userRole";
import { useUserStore } from "@/stores/userStore";

// 商家后台路由根布局：
// - 集中权限守卫（未登录 → login；非员工 → (tabs)）
// - 顶部「订单 / 售后 / 商品 / 员工」由各列表页自带的 MerchantTopTabs 承载
// - 全局 Toast 已在根布局 src/app/_layout.tsx 统一挂载，这里不再重复渲染
export default function MerchantLayout() {
  const session = useUserStore((s) => s.session);
  const role = useUserStore((s) => s.role);

  if (!session) {
    return <Redirect href="/login" />;
  }
  if (!isMerchantStaff(role)) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
