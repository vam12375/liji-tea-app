import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Switch, Alert } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useCartStore } from "@/stores/cartStore";
import { useUserStore } from "@/stores/userStore";
import AddressCard from "@/components/checkout/AddressCard";
import OrderItemCard from "@/components/checkout/OrderItemCard";
import DeliveryOptions from "@/components/checkout/DeliveryOptions";
import PaymentMethods from "@/components/checkout/PaymentMethods";
import PriceBreakdown from "@/components/checkout/PriceBreakdown";

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, subtotal, clearCart } = useCartStore();
  const { getDefaultAddress } = useUserStore();

  const [delivery, setDelivery] = useState("standard");
  const [payment, setPayment] = useState("wechat");
  const [note, setNote] = useState("");
  const [giftBox, setGiftBox] = useState(false);

  const address = getDefaultAddress();
  const shippingCost = delivery === "express" ? 15 : 0;
  const discount = subtotal() >= 1000 ? 50 : 0;
  const giftBoxPrice = giftBox ? 28 : 0;
  const total = subtotal() + shippingCost - discount + giftBoxPrice;

  const handleSubmit = () => {
    Alert.alert("订单已提交", `订单金额: ¥${total}`, [
      {
        text: "确定",
        onPress: () => {
          clearCart();
          router.replace("/(tabs)");
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "确认订单",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-4 gap-5 pb-32"
        showsVerticalScrollIndicator={false}
      >
        {/* 收货地址 */}
        {address && <AddressCard address={address} />}

        {/* 订单商品 */}
        <View className="bg-surface-container-lowest rounded-xl px-4">
          {items.map((item) => (
            <OrderItemCard key={item.product.id} item={item} />
          ))}
        </View>

        {/* 配送方式 */}
        <DeliveryOptions selected={delivery} onSelect={setDelivery} />

        {/* 支付方式 */}
        <PaymentMethods selected={payment} onSelect={setPayment} />

        {/* 订单备注 */}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="备注: 请轻拿轻放..."
          placeholderTextColor={Colors.outline}
          className="bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface"
          multiline
        />

        {/* 礼盒包装 */}
        <View className="flex-row items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
          <View className="flex-row items-center gap-3">
            <MaterialIcons name="card-giftcard" size={20} color={Colors.tertiary} />
            <Text className="text-on-surface text-sm">
              精美礼盒包装{" "}
              <Text className="text-tertiary font-medium">+¥28</Text>
            </Text>
          </View>
          <Switch
            value={giftBox}
            onValueChange={setGiftBox}
            trackColor={{ true: Colors.primaryContainer, false: Colors.outlineVariant }}
            thumbColor="#fff"
          />
        </View>

        {/* 价格明细 */}
        <PriceBreakdown
          subtotal={subtotal()}
          shipping={shippingCost}
          discount={discount}
          giftBox={giftBox}
        />
      </ScrollView>

      {/* 底部提交栏 */}
      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3"
      >
        <Pressable
          onPress={handleSubmit}
          className="bg-primary-container rounded-full py-4 flex-row items-center justify-center gap-4 active:bg-primary"
        >
          <Text className="text-on-primary font-medium text-base">提交订单</Text>
          <Text className="text-on-primary font-headline text-lg font-bold">
            ¥{total}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
