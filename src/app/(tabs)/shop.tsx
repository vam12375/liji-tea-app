import { useState, useMemo } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import SearchBar from "@/components/shop/SearchBar";
import FilterChips from "@/components/shop/FilterChips";
import ShopProductCard from "@/components/shop/ShopProductCard";
import { type TeaCategory } from "@/data/products";
import { useProductStore } from "@/stores/productStore";

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TeaCategory>("全部");
  const { products: allProducts } = useProductStore();

  // 筛选产品
  const filteredProducts = useMemo(() => {
    let result = allProducts;
    if (category !== "全部") {
      result = result.filter((p) => p.category === category);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.origin.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allProducts, category, search]);

  return (
    <View className="flex-1 bg-background">
      {/* 顶部导航 */}
      <View style={{ paddingTop: insets.top }} className="px-4 pb-3 bg-background">
        <View className="flex-row justify-between items-center h-14">
          <View className="flex-row items-center gap-3">
            <MaterialIcons name="menu" size={24} color={Colors.primary} />
            <Text className="font-headline text-2xl tracking-widest font-bold text-primary">
              李记茶
            </Text>
          </View>
          <Pressable hitSlop={8}>
            <MaterialIcons name="search" size={24} color={Colors.primary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperClassName="gap-3 px-4"
        contentContainerClassName="gap-4 pb-8"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View className="gap-4 px-4">
            <SearchBar value={search} onChangeText={setSearch} />
            <FilterChips selected={category} onSelect={setCategory} />
            {/* 排序行 */}
            <View className="flex-row justify-between items-center">
              <Text className="text-on-surface-variant text-sm">
                {filteredProducts.length} 款茶品
              </Text>
              <Pressable className="flex-row items-center gap-1">
                <Text className="text-on-surface-variant text-sm">排序: 推荐</Text>
                <MaterialIcons
                  name="expand-more"
                  size={18}
                  color={Colors.outline}
                />
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ShopProductCard
            product={item}
            onPress={() => router.push(`/product/${item.id}` as any)}
          />
        )}
      />
    </View>
  );
}
