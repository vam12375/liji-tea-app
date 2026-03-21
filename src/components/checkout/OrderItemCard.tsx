import { View, Text } from "react-native";
import { Image } from "expo-image";
import type { CartItem } from "@/stores/cartStore";

interface OrderItemCardProps {
  item: CartItem;
}

export default function OrderItemCard({ item }: OrderItemCardProps) {
  const { product, quantity } = item;

  return (
    <View className="flex-row items-center gap-3 py-3">
      <Image
        source={{ uri: product.image }}
        className="w-[60px] h-[60px] rounded-lg"
        contentFit="cover"
      />
      <View className="flex-1 gap-1">
        <Text className="font-headline text-on-surface text-sm" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="text-outline text-xs">{product.unit}</Text>
      </View>
      <View className="items-end gap-1">
        <Text className="font-headline text-on-surface text-sm">
          ¥{product.price}
        </Text>
        <Text className="text-outline text-xs">x{quantity}</Text>
      </View>
    </View>
  );
}
