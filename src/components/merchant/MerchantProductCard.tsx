import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { LOW_STOCK_THRESHOLD } from "@/lib/merchantFilters";
import type { Product } from "@/types/database";

// 商品卡片：名称 / 价格 / 库存 / 上下架徽标；低库存加 ⚠️ 提醒。
export function MerchantProductCard({ product }: { product: Product }) {
  const active = product.is_active !== false;
  const low = (product.stock ?? 0) < LOW_STOCK_THRESHOLD;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/merchant/products/[id]",
          params: { id: product.id },
        } as never)
      }
      className="mx-4 my-2 p-4 rounded-2xl bg-surface-bright flex-row items-center justify-between"
    >
      <View className="flex-1 pr-3">
        <Text className="text-on-surface font-semibold" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="text-on-surface-variant text-xs mt-1">
          ¥{product.price} · 库存 {product.stock ?? 0}
          {low ? " · ⚠️ 低库存" : ""}
        </Text>
      </View>
      <Text
        className={`text-xs ${active ? "text-primary" : "text-on-surface-variant"}`}
      >
        {active ? "已上架" : "已下架"}
      </Text>
    </Pressable>
  );
}
