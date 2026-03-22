import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useCartStore } from "@/stores/cartStore";
import { useUserStore } from "@/stores/userStore";
import { showModal } from "@/stores/modalStore";
import CartItemCard from "@/components/cart/CartItemCard";
import OrderSummary from "@/components/cart/OrderSummary";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, updateQuantity, removeItem, subtotal, totalItems } =
    useCartStore();
  const session = useUserStore((s) => s.session);

  // 编辑模式状态
  const [editing, setEditing] = useState(false);
  // 已选中的商品 ID 集合
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isEmpty = items.length === 0;

  /** 切换单个商品的选中状态 */
  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** 全选/全不选 */
  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.product.id)));
    }
  };

  /** 删除所选商品 */
  const deleteSelected = () => {
    selected.forEach((id) => removeItem(id));
    setSelected(new Set());
    setEditing(false);
  };

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
          headerRight: () =>
            !isEmpty ? (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setEditing((prev) => !prev);
                  setSelected(new Set());
                }}
              >
                <Text className="text-tertiary text-sm">
                  {editing ? "完成" : "编辑"}
                </Text>
              </Pressable>
            ) : null,
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
              <View key={item.product.id} className="flex-row items-center">
                {/* 编辑模式下显示复选框 */}
                {editing && (
                  <Pressable
                    onPress={() => toggleSelected(item.product.id)}
                    className="pr-3"
                    hitSlop={6}
                  >
                    <MaterialIcons
                      name={selected.has(item.product.id) ? "check-box" : "check-box-outline-blank"}
                      size={24}
                      color={selected.has(item.product.id) ? Colors.primary : Colors.outline}
                    />
                  </Pressable>
                )}
                <View className="flex-1">
                  <CartItemCard
                    item={item}
                    onUpdateQuantity={(qty) =>
                      updateQuantity(item.product.id, qty)
                    }
                    onRemove={() => removeItem(item.product.id)}
                  />
                </View>
              </View>
            ))}

            {/* 优惠码 */}
            <View className="flex-row border border-dashed border-outline-variant rounded-xl overflow-hidden mt-4">
              <TextInput
                placeholder="输入优惠码"
                placeholderTextColor={Colors.outline}
                className="flex-1 px-4 py-3 text-sm text-on-surface"
              />
              <Pressable
                onPress={() => showModal("提示", "优惠码功能即将上线")}
                className="bg-primary-container px-5 items-center justify-center"
              >
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

          {/* 编辑模式：批量删除底栏 */}
          {editing ? (
            <View
              style={{ paddingBottom: insets.bottom || 16 }}
              className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3 flex-row items-center justify-between"
            >
              {/* 全选 */}
              <Pressable
                onPress={toggleSelectAll}
                className="flex-row items-center gap-2"
                hitSlop={6}
              >
                <MaterialIcons
                  name={selected.size === items.length && items.length > 0 ? "check-box" : "check-box-outline-blank"}
                  size={22}
                  color={selected.size === items.length && items.length > 0 ? Colors.primary : Colors.outline}
                />
                <Text className="text-on-surface text-sm">全选</Text>
              </Pressable>
              {/* 删除所选 */}
              <Pressable
                onPress={deleteSelected}
                disabled={selected.size === 0}
                className={`px-6 py-2.5 rounded-full ${selected.size === 0 ? "bg-error/30" : "bg-error"}`}
              >
                <Text className="text-on-error font-medium">
                  删除所选 ({selected.size})
                </Text>
              </Pressable>
            </View>
          ) : (
            /* 正常模式：结算底栏 */
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
                onPress={() => {
                  if (!session) {
                    router.push('/login' as any);
                    return;
                  }
                  router.push("/checkout" as any);
                }}
                className="bg-primary-container px-8 py-3 rounded-full active:bg-primary"
              >
                <Text className="text-on-primary font-medium">
                  去结算 ({totalItems()})
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}
