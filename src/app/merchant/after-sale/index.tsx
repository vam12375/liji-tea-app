import { useEffect, useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";

import { MerchantAfterSaleCard } from "@/components/merchant/MerchantAfterSaleCard";
import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import {
  filterMerchantAfterSales,
  type MerchantAfterSaleScope,
} from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";
import { useUserStore } from "@/stores/userStore";

const SCOPES: { value: MerchantAfterSaleScope; label: string }[] = [
  { value: "pending",  label: "待审核" },
  { value: "approved", label: "已同意" },
  { value: "rejected", label: "已拒绝" },
  { value: "refunded", label: "已完成" },
  { value: "all",      label: "全部" },
];

export default function MerchantAfterSaleScreen() {
  const role = useUserStore((s) => s.role);
  const list = useMerchantStore((s) => s.afterSales);
  const loading = useMerchantStore((s) => s.afterSalesLoading);
  const filter = useMerchantStore((s) => s.afterSaleFilter);
  const setFilter = useMerchantStore((s) => s.setAfterSaleFilter);
  const fetch = useMerchantStore((s) => s.fetchAfterSales);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const visible = useMemo(
    () => filterMerchantAfterSales(list, filter),
    [list, filter],
  );

  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="after-sale" showStaff={role === "admin"} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        className="border-b border-outline-variant bg-background"
      >
        {SCOPES.map((s) => {
          const active = filter.status === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => setFilter({ status: s.value })}
              className={`px-3 py-1.5 rounded-full mr-2 ${
                active ? "bg-primary" : "bg-surface-variant"
              }`}
            >
              <Text
                className={`text-xs ${
                  active ? "text-on-primary" : "text-on-surface"
                }`}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && visible.length === 0 ? (
        <ScreenState variant="loading" title="加载中" />
      ) : visible.length === 0 ? (
        <ScreenState variant="empty" title="暂无匹配售后申请" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => <MerchantAfterSaleCard request={item} />}
          onRefresh={fetch}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
