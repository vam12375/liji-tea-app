import { useEffect, useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { MerchantHeroStats } from "@/components/merchant/MerchantHeroStats";
import { MerchantProductCard } from "@/components/merchant/MerchantProductCard";
import { MerchantScreenHeader } from "@/components/merchant/MerchantScreenHeader";
import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { MerchantColors } from "@/constants/MerchantColors";
import {
  LOW_STOCK_THRESHOLD,
  filterMerchantProducts,
  type MerchantProductScope,
} from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";
import { useUserStore } from "@/stores/userStore";

const SCOPES: { value: MerchantProductScope; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "active", label: "已上架" },
  { value: "inactive", label: "已下架" },
  { value: "low_stock", label: "低库存" },
];

export default function MerchantProductsScreen() {
  const role = useUserStore((s) => s.role);
  const products = useMerchantStore((s) => s.products);
  const loading = useMerchantStore((s) => s.productsLoading);
  const filter = useMerchantStore((s) => s.productFilter);
  const setFilter = useMerchantStore((s) => s.setProductFilter);
  const fetch = useMerchantStore((s) => s.fetchProducts);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const visible = useMemo(
    () => filterMerchantProducts(products, filter),
    [products, filter],
  );

  // Hero 四数字（本模块是唯一 4 个的场景）：在架 / 下架 / 低库存 / 全部。
  // '低库存'挂 onPress，点击直达 low_stock 筛选，解放'选 chip 再看列表'两步。
  const heroItems = useMemo(
    () => [
      {
        value: products.filter((p) => p.is_active === true).length,
        label: "在架",
      },
      {
        value: products.filter((p) => p.is_active === false).length,
        label: "下架",
      },
      {
        value: products.filter((p) => (p.stock ?? 0) < LOW_STOCK_THRESHOLD)
          .length,
        label: "低库存",
        accent: MerchantColors.statusWait,
        onPress: () => setFilter({ scope: "low_stock" }),
      },
      {
        value: products.length,
        label: "全部",
      },
    ],
    [products, setFilter],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="products" showStaff={role === "admin"} />
      <MerchantScreenHeader
        title="商品与库存"
        actionIcon="refresh"
        actionLabel="刷新"
        onAction={() => void fetch()}
      />
      <MerchantHeroStats items={heroItems} />

      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          gap: 10,
          borderBottomColor: MerchantColors.line,
          borderBottomWidth: 1,
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SCOPES.map((s) => {
            const active = filter.scope === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setFilter({ scope: s.value })}
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
        <TextInput
          value={filter.keyword}
          onChangeText={(v) => setFilter({ keyword: v })}
          placeholder="搜索商品名"
          placeholderTextColor={MerchantColors.ink500}
          style={{
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: MerchantColors.line,
            fontSize: 13,
            color: MerchantColors.ink900,
          }}
        />
      </View>

      {loading && visible.length === 0 ? (
        <ScreenState variant="loading" title="加载中" />
      ) : visible.length === 0 ? (
        <ScreenState variant="empty" title="暂无匹配商品" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(x) => x.id}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 5) * 40).duration(200)}
            >
              <MerchantProductCard product={item} />
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
