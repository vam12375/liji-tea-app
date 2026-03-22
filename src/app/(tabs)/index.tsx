import { useEffect } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import TopAppBar from "@/components/home/TopAppBar";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryRow from "@/components/home/CategoryRow";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import CultureBanner from "@/components/home/CultureBanner";
import NewArrivals from "@/components/home/NewArrivals";
import SeasonalStory from "@/components/home/SeasonalStory";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";

export default function HomeScreen() {
  const router = useRouter();
  // 首页挂载时拉取产品数据
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  const totalItems = useCartStore((s) => s.totalItems);

  useEffect(() => {
    fetchProducts();
  }, []);

  const cartCount = totalItems();

  return (
    <View className="flex-1 bg-background">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 gap-8"
        showsVerticalScrollIndicator={false}
      >
        <HeroBanner />
        <CategoryRow />
        <FeaturedProducts />
        <CultureBanner />
        <NewArrivals />
        <SeasonalStory />
      </ScrollView>

      {/* 购物车悬浮按钮 — 仅在有商品时显示 */}
      {cartCount > 0 && (
        <Pressable
          onPress={() => router.push("/cart" as any)}
          className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center active:opacity-80"
          style={{
            bottom: 90,
            right: 16,
            elevation: 6,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.27,
            shadowRadius: 4.65,
          }}
        >
          <MaterialIcons name="shopping-cart" size={24} color="#fff" />
          {/* 数量角标 */}
          <View
            className="absolute -top-1 -right-1 bg-error rounded-full items-center justify-center"
            style={{ minWidth: 20, height: 20, paddingHorizontal: 4 }}
          >
            <Text className="text-white text-xs font-bold">
              {cartCount > 99 ? "99+" : cartCount}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
