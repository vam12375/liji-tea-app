import { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import TopAppBar from "@/components/home/TopAppBar";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryRow from "@/components/home/CategoryRow";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import CultureBanner from "@/components/home/CultureBanner";
import NewArrivals from "@/components/home/NewArrivals";
import SeasonalStory from "@/components/home/SeasonalStory";
import { track } from "@/lib/analytics";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";
import { Colors } from "@/constants/Colors";

export default function HomeScreen() {
  const router = useRouter();
  // 首页挂载时拉取产品数据
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  // 直接在 selector 内计算，避免每次渲染重复 reduce
  const cartCount = useCartStore((s) =>
    s.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  // 下拉刷新状态
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // 首页曝光埋点：冷启或 Tab 切回都会触发，作为 DAU / 跳失率基线。
    track("home_impression");
    void fetchProducts();
  }, [fetchProducts]);

  /** 下拉刷新处理 — 重新拉取产品列表 */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-background">
      <TopAppBar />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8 gap-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
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
          onPress={() => router.push("/cart")}
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
