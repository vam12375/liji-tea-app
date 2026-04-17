import { useEffect, useMemo } from "react";
import { FlatList, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { MerchantHeroStats } from "@/components/merchant/MerchantHeroStats";
import { MerchantOrderCard } from "@/components/merchant/MerchantOrderCard";
import { MerchantOrderFilterBar } from "@/components/merchant/MerchantOrderFilterBar";
import { MerchantScreenHeader } from "@/components/merchant/MerchantScreenHeader";
import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { MerchantColors } from "@/constants/MerchantColors";
import { filterMerchantOrders } from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";
import { useUserStore } from "@/stores/userStore";

// 订单履约列表（v4.4.0 Editorial 重排）：
// 顶部 TopTabs → 衬线大标题 + 刷新 → 三数字 Hero → chips 搜索 → 入场列表。
// Hero 数字直接从 orders 派生，零接口改动。
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

  // Hero 三数字：统计全量 orders，而非 visible（筛选后不应让大数字跟着抖）。
  const heroItems = useMemo(() => {
    const count = (pred: (o: (typeof orders)[number]) => boolean) =>
      orders.filter(pred).length;
    return [
      {
        value: count((o) => o.status === "paid"),
        label: "待发货",
        accent: MerchantColors.statusWait,
      },
      {
        value: count((o) => o.status === "shipping"),
        label: "进行中",
        accent: MerchantColors.statusGo,
      },
      {
        value: count((o) => o.status === "delivered"),
        label: "已完成",
      },
    ];
  }, [orders]);

  return (
    <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="orders" showStaff={role === "admin"} />
      <MerchantScreenHeader
        title="订单履约"
        actionIcon="refresh"
        actionLabel="刷新"
        onAction={() => void fetchOrders()}
      />
      <MerchantHeroStats items={heroItems} />
      <MerchantOrderFilterBar filter={filter} onChange={setFilter} />
      {loading && visible.length === 0 ? (
        <ScreenState variant="loading" title="加载中" />
      ) : visible.length === 0 ? (
        <ScreenState variant="empty" title="暂无匹配订单" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          // 前 6 项做 FadeInDown 入场，stagger 40ms；再往后不再 delay，防长列表卡。
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 5) * 40).duration(200)}
            >
              <MerchantOrderCard order={item} />
            </Animated.View>
          )}
          onRefresh={fetchOrders}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
