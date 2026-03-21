import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useCartStore } from "@/stores/cartStore";
import CartItemCard from "@/components/cart/CartItemCard";
import OrderSummary from "@/components/cart/OrderSummary";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, updateQuantity, removeItem, subtotal, totalItems } =
    useCartStore();

  const isEmpty = items.length === 0;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "购物车",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable hitSlop={8}>
              <Text className="text-tertiary text-sm">编辑</Text>
            </Pressable>
          ),
        }}
      />

      {isEmpty ? (
        /* 空购物车 */
        <View className="flex-1 items-center justify-center gap-4">
          <MaterialIcons name="shopping-cart" size={64} color={Colors.outlineVariant} />
          <Text className="text-outline text-base">购物车是空的</Text>
          <Pressable
            onPress={() => router.push("/(tabs)/shop")}
            className="bg-primary-container px-6 py-2.5 rounded-full"
          >
            <Text className="text-on-primary font-medium">去逛逛</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 py-4 gap-3 pb-44"
            showsVerticalScrollIndicator={false}
          >
            {/* 购物车商品列表 */}
            {items.map((item) => (
              <CartItemCard
                key={item.product.id}
                item={item}
                onUpdateQuantity={(qty) =>
                  updateQuantity(item.product.id, qty)
                }
                onRemove={() => removeItem(item.product.id)}
              />
            ))}

            {/* 优惠码 */}
            <View className="flex-row border border-dashed border-outline-variant rounded-xl overflow-hidden mt-4">
              <TextInput
                placeholder="输入优惠码"
                placeholderTextColor={Colors.outline}
                className="flex-1 px-4 py-3 text-sm text-on-surface"
              />
              <Pressable className="bg-primary-container px-5 items-center justify-center">
                <Text className="text-on-primary text-sm font-medium">使用</Text>
              </Pressable>
            </View>

            {/* 订单摘要 */}
            <OrderSummary
              subtotal={subtotal()}
              shipping={0}
              discount={subtotal() >= 1000 ? 50 : 0}
            />
          </ScrollView>

          {/* 底部结算栏 */}
          <View
            style={{ paddingBottom: insets.bottom || 16 }}
            className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3 flex-row items-center justify-between"
          >
            <View>
              <Text className="text-outline text-xs">合计</Text>
              <Text className="text-primary text-xl font-bold">
                ¥{subtotal() - (subtotal() >= 1000 ? 50 : 0)}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/checkout" as any)}
              className="bg-primary-container px-8 py-3 rounded-full active:bg-primary"
            >
              <Text className="text-on-primary font-medium">
                去结算 ({totalItems()})
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
