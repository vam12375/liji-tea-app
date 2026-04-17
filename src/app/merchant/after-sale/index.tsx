import { useEffect, useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { MerchantAfterSaleCard } from "@/components/merchant/MerchantAfterSaleCard";
import { MerchantHeroStats } from "@/components/merchant/MerchantHeroStats";
import { MerchantScreenHeader } from "@/components/merchant/MerchantScreenHeader";
import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { MerchantColors } from "@/constants/MerchantColors";
import {
  filterMerchantAfterSales,
  type MerchantAfterSaleScope,
} from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";
import { useUserStore } from "@/stores/userStore";

const SCOPES: { value: MerchantAfterSaleScope; label: string }[] = [
  { value: "pending", label: "待审核" },
  { value: "approved", label: "已同意" },
  { value: "rejected", label: "已拒绝" },
  { value: "refunded", label: "已完成" },
  { value: "all", label: "全部" },
];

// pending 映射集合：用于 Hero 数字与 chips 切换共享判断。
const PENDING_STATUS = ["submitted", "pending_review", "auto_approved"];

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

  // Hero 三数字派生自全量 list；approved/refunding 合并为"已同意"更贴店员语境。
  const heroItems = useMemo(
    () => [
      {
        value: list.filter((r) => PENDING_STATUS.includes(r.status)).length,
        label: "待审核",
        accent: MerchantColors.statusWait,
      },
      {
        value: list.filter((r) => ["approved", "refunding"].includes(r.status))
          .length,
        label: "已同意",
        accent: MerchantColors.statusGo,
      },
      {
        value: list.filter((r) => r.status === "refunded").length,
        label: "已完成",
      },
    ],
    [list],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="after-sale" showStaff={role === "admin"} />
      <MerchantScreenHeader
        title="售后处理"
        actionIcon="refresh"
        actionLabel="刷新"
        onAction={() => void fetch()}
      />
      <MerchantHeroStats items={heroItems} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          gap: 8,
        }}
        style={{
          borderBottomColor: MerchantColors.line,
          borderBottomWidth: 1,
        }}
      >
        {SCOPES.map((s) => {
          const active = filter.status === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => setFilter({ status: s.value })}
              style={{
                height: 28,
                paddingHorizontal: 14,
                borderRadius: 999,
                justifyContent: "center",
                marginRight: 8,
                backgroundColor: active ? "#435c3c" : "transparent",
                borderWidth: 1,
                borderColor: active ? "#435c3c" : MerchantColors.line,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? "600" : "500",
                  color: active ? "#fff" : MerchantColors.ink500,
                }}
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
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 5) * 40).duration(200)}
            >
              <MerchantAfterSaleCard request={item} />
            </Animated.View>
          )}
          onRefresh={fetch}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
