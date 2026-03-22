import { useEffect } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useProductStore } from "@/stores/productStore";
import { useCartStore } from "@/stores/cartStore";
import { useUserStore } from "@/stores/userStore";
import TastingProfile from "@/components/product/TastingProfile";
import BrewingGuideCard from "@/components/product/BrewingGuideCard";
import ProcessTimeline from "@/components/product/ProcessTimeline";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addItem = useCartStore((s) => s.addItem);
  const totalItems = useCartStore((s) => s.totalItems);
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  const isFavorite = useUserStore((s) => s.isFavorite);

  const products = useProductStore((s) => s.products);
  const product = products.find((p) => p.id === id);

  // 实时订阅库存变化
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`product-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${id}` },
        (payload) => {
          useProductStore.getState().updateProduct(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (!product) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-outline">产品未找到</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero 图片 */}
        <View className="h-[360px] relative">
          <Image
            source={{ uri: product.image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={300}
          />
          <View className="absolute inset-0 bg-black/30" />

          {/* 顶部导航按钮 */}
          <View
            style={{ paddingTop: insets.top }}
            className="absolute top-0 left-0 right-0 flex-row justify-between items-center px-4"
          >
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <View className="flex-row gap-3">
              <Pressable className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center">
                <MaterialIcons name="share" size={22} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => toggleFavorite(id!)}
                className="w-10 h-10 rounded-full bg-surface/20 items-center justify-center"
              >
                <MaterialIcons
                  name={isFavorite(id!) ? "favorite" : "favorite-border"}
                  size={22}
                  color="#fff"
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* 内容卡片 - 上移覆盖 */}
        <View className="bg-background rounded-t-3xl -mt-8 pt-8 px-6 pb-32 gap-8">
          {/* 基本信息 */}
          <View className="gap-2">
            <Text className="font-headline text-3xl text-on-surface font-bold">
              {product.name}
            </Text>
            <Text className="text-outline text-sm">{product.origin}</Text>
            {product.tagline && (
              <Text className="text-on-surface-variant text-sm italic mt-1">
                "{product.tagline}"
              </Text>
            )}
            <Text className="text-primary text-2xl font-bold mt-3">
              ¥{product.price}
              <Text className="text-outline text-sm font-normal">
                /{product.unit}
              </Text>
            </Text>
          </View>

          {/* 风味赏析 */}
          {product.tastingProfile && (
            <TastingProfile items={product.tastingProfile} />
          )}

          {/* 冲泡指南 */}
          {product.brewingGuide && (
            <BrewingGuideCard guide={product.brewingGuide} />
          )}

          {/* 产地故事 */}
          {product.originStory && (
            <View className="gap-3">
              <Text className="font-headline text-lg text-on-surface">
                产地故事
              </Text>
              <Text className="text-on-surface-variant text-sm leading-relaxed">
                {product.originStory}
              </Text>
            </View>
          )}

          {/* 制作工艺 */}
          {product.process && <ProcessTimeline steps={product.process} />}
        </View>
      </ScrollView>

      {/* 底部操作栏 */}
      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3 flex-row items-center gap-3"
      >
        {/* 购物车图标 */}
        <Pressable
          onPress={() => router.push("/cart" as any)}
          className="w-12 h-12 rounded-full border border-outline-variant items-center justify-center relative"
        >
          <MaterialIcons name="shopping-cart" size={22} color={Colors.primary} />
          {totalItems() > 0 && (
            <View className="absolute -top-1 -right-1 bg-error w-5 h-5 rounded-full items-center justify-center">
              <Text className="text-on-error text-[10px] font-bold">
                {totalItems()}
              </Text>
            </View>
          )}
        </Pressable>

        {/* 加入购物车 */}
        <Pressable
          onPress={() => addItem(product)}
          className="flex-1 bg-surface-container-high h-12 rounded-full items-center justify-center active:bg-surface-container-highest"
        >
          <Text className="text-on-surface font-medium">加入购物车</Text>
        </Pressable>

        {/* 立即购买 */}
        <Pressable
          onPress={() => router.push(`/checkout?productId=${id}` as any)}
          className="flex-1 bg-primary-container h-12 rounded-full items-center justify-center active:bg-primary"
        >
          <Text className="text-on-primary font-medium">立即购买</Text>
        </Pressable>
      </View>
    </View>
  );
}
