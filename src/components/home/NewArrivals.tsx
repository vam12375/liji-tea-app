import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useProductStore } from "@/stores/productStore";

export default function NewArrivals() {
  const router = useRouter();
  const { products } = useProductStore();
  // 筛选新品
  const newArrivals = products.filter((p) => p.isNew);

  return (
    <View className="gap-4">
      <Text className="font-headline text-xl text-on-surface">新品上市</Text>

      <View className="flex-row gap-4">
        {newArrivals.map((product) => (
          <Pressable
            key={product.id}
            onPress={() => router.push(`/product/${product.id}` as any)}
            className="flex-1 bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
          >
            {/* 正方形图片 */}
            <View className="aspect-square overflow-hidden">
              <Image
                source={{ uri: product.image }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={200}
              />
            </View>

            {/* 产品信息 */}
            <View className="p-4 gap-2">
              <Text className="font-headline text-on-surface text-sm">
                {product.name}
              </Text>
              <Text className="text-[10px] text-outline leading-relaxed">
                {product.description}
              </Text>
              <View className="flex-row justify-between items-center pt-2">
                <Text className="text-primary font-bold">¥{product.price}</Text>
                <Pressable hitSlop={8}>
                  <MaterialIcons
                    name="add-circle"
                    size={22}
                    color={Colors.primaryContainer}
                  />
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
