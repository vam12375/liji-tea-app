import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useUserStore } from "@/stores/userStore";
import { useProductStore } from "@/stores/productStore";
import { useMemo } from "react";

/** 收藏页 — 展示用户收藏的茶品列表 */
export default function FavoritesScreen() {
  const router = useRouter();
  const favorites = useUserStore((s) => s.favorites);
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  const products = useProductStore((s) => s.products);

  // 交叉匹配：从收藏 ID 列表找到对应产品
  const favoriteProducts = useMemo(
    () => products.filter((p) => favorites.includes(p.id)),
    [products, favorites]
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "我的收藏",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      {favoriteProducts.length === 0 ? (
        /* 空状态 */
        <View className="flex-1 items-center justify-center gap-4">
          <MaterialIcons name="favorite-border" size={48} color={Colors.outlineVariant} />
          <Text className="text-outline text-base">还没有收藏的茶品</Text>
          <Pressable
            onPress={() => router.push("/(tabs)/shop")}
            className="bg-primary-container px-6 py-2.5 rounded-full"
          >
            <Text className="text-on-primary text-sm font-medium">去逛逛</Text>
          </Pressable>
        </View>
      ) : (
        /* 2列网格 */
        <FlatList
          data={favoriteProducts}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperClassName="gap-3 px-4"
          contentContainerClassName="gap-4 pb-8 pt-4"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: "/product/[id]", params: { id: item.id } })
              }
              className="flex-1 bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
            >
              {/* 产品图片 - 4:5 比例 */}
              <View className="aspect-[4/5] overflow-hidden">
                <Image
                  source={{ uri: item.image }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={200}
                />
                {/* 红心覆盖层 — 点击取消收藏 */}
                <Pressable
                  onPress={() => toggleFavorite(item.id)}
                  hitSlop={8}
                  className="absolute top-2 right-2 bg-background/70 rounded-full p-1.5"
                >
                  <MaterialIcons name="favorite" size={18} color={Colors.error} />
                </Pressable>
              </View>

              {/* 产品信息 */}
              <View className="p-3 gap-1.5">
                <Text className="font-headline text-on-surface text-sm" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-[10px] text-outline">{item.origin}</Text>
                <Text className="text-primary font-bold text-base">
                  ¥{item.price}
                  <Text className="text-outline text-[10px] font-normal">
                    /{item.unit}
                  </Text>
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
