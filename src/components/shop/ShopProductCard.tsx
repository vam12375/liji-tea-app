import { useRef, useCallback } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { TeaImage } from "@/components/ui/TeaImage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { Product } from "@/data/products";
import { useUserStore } from "@/stores/userStore";
import { useCartStore } from "@/stores/cartStore";

interface ShopProductCardProps {
  product: Product;
  onPress?: () => void;
}

export default function ShopProductCard({
  product,
  onPress,
}: ShopProductCardProps) {
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  // 直接订阅 favorites 数组确保收藏状态实时响应
  const favorites = useUserStore((s) => s.favorites);
  const isFav = favorites.includes(product.id);
  const addItem = useCartStore((s) => s.addItem);

  // 收藏心跳动画
  const heartScale = useRef(new Animated.Value(1)).current;
  // 快速加购动画
  const cartBounce = useRef(new Animated.Value(1)).current;

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite(product.id);
    // 弹跳动画
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.5, useNativeDriver: true, damping: 6 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, damping: 8 }),
    ]).start();
  }, [heartScale, product.id, toggleFavorite]);

  /** 快速加入购物车 + 弹跳反馈 */
  const handleQuickAdd = useCallback(() => {
    addItem(product);
    Animated.sequence([
      Animated.spring(cartBounce, { toValue: 1.4, useNativeDriver: true, damping: 6 }),
      Animated.spring(cartBounce, { toValue: 1, useNativeDriver: true, damping: 8 }),
    ]).start();
  }, [addItem, cartBounce, product]);

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
    >
      {/* 产品图片 - 4:5 比例 */}
      <View className="aspect-[4/5] overflow-hidden">
        <TeaImage
          source={{ uri: product.image }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
        />
      </View>

      {/* 产品信息 */}
      <View className="p-3 gap-1.5">
        <Text className="font-headline text-on-surface text-sm" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="text-[10px] text-outline">{product.origin}</Text>
        <View className="flex-row justify-between items-center">
          <Text className="text-primary font-bold text-base">
            ¥{product.price}
            <Text className="text-outline text-[10px] font-normal">
              /{product.unit}
            </Text>
          </Text>
          <View className="flex-row items-center gap-2">
            {/* 快速加购按钮 */}
            <Pressable hitSlop={8} onPress={handleQuickAdd}>
              <Animated.View style={{ transform: [{ scale: cartBounce }] }}>
                <MaterialIcons
                  name="add-shopping-cart"
                  size={16}
                  color={Colors.primary}
                />
              </Animated.View>
            </Pressable>
            {/* 收藏按钮 */}
            <Pressable hitSlop={8} onPress={handleToggleFavorite}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <MaterialIcons
                  name={isFav ? "favorite" : "favorite-border"}
                  size={18}
                  color={isFav ? Colors.error : Colors.outline}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
