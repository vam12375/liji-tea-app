import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import TopAppBar from "@/components/home/TopAppBar";
import HeroBanner from "@/components/home/HeroBanner";
import CategoryRow from "@/components/home/CategoryRow";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import CultureBanner from "@/components/home/CultureBanner";
import NewArrivals from "@/components/home/NewArrivals";
import SeasonalStory from "@/components/home/SeasonalStory";
import { useProductStore } from "@/stores/productStore";

export default function HomeScreen() {
  // 首页挂载时拉取产品数据
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  useEffect(() => {
    fetchProducts();
  }, []);

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
    </View>
  );
}
