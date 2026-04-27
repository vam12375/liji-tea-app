import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";

import { TeaImage } from "@/components/ui/TeaImage";
import { routes } from "@/lib/routes";
import type { Product } from "@/stores/productStore";

export default function RelatedProducts({
  title,
  products,
}: {
  title: string;
  products: Product[];
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      <Text className="text-on-surface text-base font-bold">{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3"
      >
        {products.map((product) => (
          <Pressable
            key={product.id}
            // 内容详情里的商品卡只承担“快速去商品页”这一个任务。
            onPress={() => router.push(routes.product(product.id))}
            className="w-40 rounded-3xl bg-surface-container-low p-3 gap-2 active:opacity-80"
          >
            <TeaImage
              source={{ uri: product.image }}
              style={{ width: "100%", height: 120, borderRadius: 16 }}
              contentFit="cover"
              transition={200}
            />
            <Text
              className="text-on-surface text-sm font-bold"
              numberOfLines={2}
            >
              {product.name}
            </Text>
            <Text
              className="text-on-surface-variant text-xs"
              numberOfLines={1}
            >
              {product.origin}
            </Text>
            <Text className="text-primary text-sm font-bold">
              ¥{product.price}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
