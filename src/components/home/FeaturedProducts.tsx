import { useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import ProductCard from "@/components/product/ProductCard";
import { track } from "@/lib/analytics";
import { useProductStore } from "@/stores/productStore";

export default function FeaturedProducts() {
  const router = useRouter();
  const { products, loading } = useProductStore();
  // 取前 3 个作为推荐
  const featuredProducts = products.slice(0, 3);
  const featuredIdsKey = featuredProducts.map((item) => item.id).join(",");

  // 推荐位曝光埋点：ids 变化时触发（避免同一批次重复上报），作为 CTR 分析分母。
  useEffect(() => {
    if (!featuredIdsKey) return;
    track("product_impression", {
      productIds: featuredIdsKey.split(","),
      slot: "home_featured",
    });
  }, [featuredIdsKey]);

  if (loading && products.length === 0) {
    return (
      <View className="h-40 items-center justify-center">
        <ActivityIndicator color="#5b7553" />
      </View>
    );
  }

  return (
    <View className="gap-4">
      {/* 标题行 */}
      <View className="flex-row justify-between items-end">
        <Text className="font-headline text-xl text-on-surface">本季推荐</Text>
        <Pressable onPress={() => router.push("/(tabs)/shop")}>
          <Text className="text-tertiary text-sm font-medium">
            查看全部 &gt;
          </Text>
        </Pressable>
      </View>

      {/* 横向滚动产品列表 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-4"
      >
        {featuredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onPress={() =>
              router.push({ pathname: "/product/[id]", params: { id: product.id } })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}
