import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { MerchantStatusBadge } from "@/components/merchant/MerchantStatusBadge";
import { MerchantColors } from "@/constants/MerchantColors";
import { LOW_STOCK_THRESHOLD } from "@/lib/merchantFilters";
import type { Product } from "@/types/database";

// 商品卡片：纸白底 + 1px 米线；上下架以文字徽标区分；低库存用琥珀徽标提示。
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
      style={({ pressed }) => [
        {
          marginHorizontal: 16,
          marginVertical: 6,
          padding: 16,
          borderRadius: 20,
          backgroundColor: MerchantColors.paper,
          borderColor: MerchantColors.line,
          borderWidth: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text
          style={{
            color: MerchantColors.ink900,
            fontSize: 14,
            fontWeight: "600",
          }}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <Text
          style={{
            color: MerchantColors.ink500,
            fontSize: 12,
            marginTop: 4,
            fontVariant: ["tabular-nums"],
          }}
        >
          ¥{product.price} · 库存 {product.stock ?? 0}
        </Text>
      </View>
      <View style={{ gap: 6, alignItems: "flex-end" }}>
        <MerchantStatusBadge
          tone={active ? "go" : "done"}
          label={active ? "已上架" : "已下架"}
        />
        {low ? <MerchantStatusBadge tone="wait" label="低库存" /> : null}
      </View>
    </Pressable>
  );
}
