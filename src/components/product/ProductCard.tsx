import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import type { Product } from "@/data/products";

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
}

export default function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="w-[160px] bg-surface-container-low rounded-lg overflow-hidden active:opacity-80"
    >
      {/* 产品图片 */}
      <View className="h-40 overflow-hidden">
        <Image
          source={{ uri: product.image }}
          className="w-full h-full"
          contentFit="cover"
          transition={200}
        />
      </View>

      {/* 产品信息 */}
      <View className="p-3 gap-1">
        <Text
          className="font-headline text-on-surface text-base"
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <Text className="text-[10px] text-outline">
          产地：{product.origin}
        </Text>
        <Text className="text-primary font-bold">¥{product.price}</Text>
      </View>
    </Pressable>
  );
}
