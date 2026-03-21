import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { Product } from "@/data/products";
import { useUserStore } from "@/stores/userStore";

interface ShopProductCardProps {
  product: Product;
  onPress?: () => void;
}

export default function ShopProductCard({
  product,
  onPress,
}: ShopProductCardProps) {
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  const isFavorite = useUserStore((s) => s.isFavorite);

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
    >
      {/* 产品图片 - 4:5 比例 */}
      <View className="aspect-[4/5] overflow-hidden">
        <Image
          source={{ uri: product.image }}
          className="w-full h-full"
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
          <Pressable hitSlop={8} onPress={() => toggleFavorite(product.id)}>
            <MaterialIcons
              name={isFavorite(product.id) ? "favorite" : "favorite-border"}
              size={18}
              color={isFavorite(product.id) ? Colors.error : Colors.outline}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
