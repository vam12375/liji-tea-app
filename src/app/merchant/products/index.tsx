import { useEffect, useMemo } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { MerchantProductCard } from "@/components/merchant/MerchantProductCard";
import { MerchantTopTabs } from "@/components/merchant/MerchantTopTabs";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import {
  filterMerchantProducts,
  type MerchantProductScope,
} from "@/lib/merchantFilters";
import { useMerchantStore } from "@/stores/merchantStore";
import { useUserStore } from "@/stores/userStore";

const SCOPES: { value: MerchantProductScope; label: string }[] = [
  { value: "all",       label: "全部" },
  { value: "active",    label: "已上架" },
  { value: "inactive",  label: "已下架" },
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

  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="商家后台" showBackButton />
      <MerchantTopTabs active="products" showStaff={role === "admin"} />

      <View className="px-4 py-3 gap-2 border-b border-outline-variant bg-background">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SCOPES.map((s) => {
            const active = filter.scope === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setFilter({ scope: s.value })}
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
        <TextInput
          value={filter.keyword}
          onChangeText={(v) => setFilter({ keyword: v })}
          placeholder="搜索商品名"
          className="px-3 py-2 rounded-lg bg-surface-variant text-sm text-on-surface"
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
          renderItem={({ item }) => <MerchantProductCard product={item} />}
          onRefresh={fetch}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
