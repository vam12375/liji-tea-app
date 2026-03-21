import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import ProductCard from "@/components/product/ProductCard";
import { featuredProducts } from "@/data/products";

export default function FeaturedProducts() {
  const router = useRouter();

  return (
    <View className="gap-4">
      {/* 标题行 */}
      <View className="flex-row justify-between items-end">
        <Text className="font-headline text-xl text-on-surface">本季推荐</Text>
        <Pressable onPress={() => router.push("/(tabs)/shop" as any)}>
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
            onPress={() => router.push(`/product/${product.id}` as any)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
