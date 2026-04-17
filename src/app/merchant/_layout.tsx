import { Redirect, Stack } from "expo-router";

import { isMerchantStaff } from "@/lib/userRole";
import { useUserStore } from "@/stores/userStore";

// 商家后台路由根布局：集中完成权限守卫，子页面不再重复判定。
// 未登录 → 登录页；已登录但非员工 → 回首页；员工态 → 渲染子 Stack。
// 顶部「订单 / 售后 / 商品」切换由各列表页共享的 MerchantTopTabs 组件承载，
// 此处只保留一个 Stack，避免与底部 Tab 的 Tabs 组件产生嵌套复杂度。
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
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
