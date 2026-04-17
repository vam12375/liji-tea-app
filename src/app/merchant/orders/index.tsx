import { useEffect, useMemo } from "react";
import { FlatList, View } from "react-native";

import { MerchantOrderCard } from "@/components/merchant/MerchantOrderCard";
import { MerchantOrderFilterBar } from "@/components/merchant/MerchantOrderFilterBar";
import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { filterMerchantOrders } from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";
import { useUserStore } from "@/stores/userStore";

// 订单履约列表：默认筛「待发货」，支持关键字搜索与下拉刷新。
export default function MerchantOrdersScreen() {
  const role = useUserStore((s) => s.role);
  const orders = useMerchantStore((s) => s.orders);
  const loading = useMerchantStore((s) => s.ordersLoading);
  const filter = useMerchantStore((s) => s.orderFilter);
  const setFilter = useMerchantStore((s) => s.setOrderFilter);
  const fetchOrders = useMerchantStore((s) => s.fetchOrders);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const visible = useMemo(
    () => filterMerchantOrders(orders, filter),
    [orders, filter],
  );

  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="orders" showStaff={role === "admin"} />
      <MerchantOrderFilterBar filter={filter} onChange={setFilter} />
      {loading && visible.length === 0 ? (
        <ScreenState variant="loading" title="加载中" />
      ) : visible.length === 0 ? (
        <ScreenState variant="empty" title="暂无匹配订单" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MerchantOrderCard order={item} />}
          onRefresh={fetchOrders}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
