import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import type { CartItem } from "@/stores/cartStore";

interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export default function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemCardProps) {
  const { product, quantity } = item;

  return (
    <View className="flex-row bg-surface-container-low rounded-xl p-3 gap-3 active:scale-[0.98]">
      {/* 产品图片 */}
      <Image
        source={{ uri: product.image }}
        style={{ width: 80, height: 80, borderRadius: 8 }}
        contentFit="cover"
      />

      {/* 产品信息 */}
      <View className="flex-1 justify-between">
        <View>
          <Text className="font-headline text-on-surface text-sm" numberOfLines={1}>
            {product.name}
          </Text>
          <Text className="text-[10px] text-outline mt-0.5">
            {product.origin}
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-primary font-bold">¥{product.price}</Text>

          {/* 数量控制 */}
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => onUpdateQuantity(quantity - 1)}
              className="w-7 h-7 rounded-full border border-outline-variant items-center justify-center"
            >
              <MaterialIcons name="remove" size={16} color={Colors.outline} />
            </Pressable>
            <Text className="text-on-surface text-sm w-5 text-center">
              {quantity}
            </Text>
            <Pressable
              onPress={() => onUpdateQuantity(quantity + 1)}
              className="w-7 h-7 rounded-full border border-outline-variant items-center justify-center"
            >
              <MaterialIcons name="add" size={16} color={Colors.outline} />
            </Pressable>
          </View>
        </View>

        {/* 删除按钮 */}
        <Pressable onPress={onRemove} className="self-end mt-1">
          <Text className="text-outline text-[10px]">删除</Text>
        </Pressable>
      </View>
    </View>
  );
}
