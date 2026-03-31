import AddressCard from "@/components/checkout/AddressCard";
import DeliveryOptions from "@/components/checkout/DeliveryOptions";
import OrderItemCard from "@/components/checkout/OrderItemCard";
import PaymentMethods from "@/components/checkout/PaymentMethods";
import PriceBreakdown from "@/components/checkout/PriceBreakdown";
import { Colors } from "@/constants/Colors";
import { useCartStore } from "@/stores/cartStore";
import { showModal } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import { useProductStore } from "@/stores/productStore";
import { useUserStore } from "@/stores/userStore";
import type { PaymentChannel } from "@/types/payment";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 订单业务规则常量 — 修改价格只需改这里
const SHIPPING_EXPRESS = 15;
const DISCOUNT_THRESHOLD = 1000;
const DISCOUNT_AMOUNT = 50;
const GIFT_BOX_PRICE = 28;

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { items: cartItems } = useCartStore();
  const { getDefaultAddress } = useUserStore();
  const { createOrder } = useOrderStore();

  // 从 store 获取产品列表
  const products = useProductStore((s) => s.products);

  // 区分"直接购买"和"购物车结算"
  const orderItems = useMemo(() => {
    if (productId) {
      const product = products.find((p) => p.id === productId);
      if (product) return [{ product, quantity: 1 }];
    }
    return cartItems;
  }, [productId, cartItems, products]);

  const orderSubtotal = useMemo(
    () =>
      orderItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
    [orderItems],
  );

  const [delivery, setDelivery] = useState("standard");
  const [payment, setPayment] = useState<PaymentChannel>("alipay");
  const [note, setNote] = useState("");
  const [giftBox, setGiftBox] = useState(false);

  const address = getDefaultAddress();
  const shippingCost = delivery === "express" ? SHIPPING_EXPRESS : 0;
  const discount = orderSubtotal >= DISCOUNT_THRESHOLD ? DISCOUNT_AMOUNT : 0;
  const giftBoxPrice = giftBox ? GIFT_BOX_PRICE : 0;
  const total =
    Math.round((orderSubtotal + shippingCost - discount + giftBoxPrice) * 100) /
    100;

  const handleSubmit = async () => {
    const session = useUserStore.getState().session;
    if (!session) {
      router.push("/login" as any);
      return;
    }
    if (!address) {
      showModal("提示", "请添加收货地址");
      return;
    }
    const { orderId, error } = await createOrder({
      items: orderItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.product.price,
      })),
      addressId: address.id,
      total,
      deliveryType: delivery,
      paymentMethod: payment,
      notes: note || undefined,
      giftWrap: giftBox,
    });

    if (error) {
      showModal("订单失败", error, "error");
      return;
    }

    // 跳转到支付页，由服务端生成支付单并等待服务端确认
    router.replace(
      `/payment?orderId=${orderId}&total=${total.toFixed(2)}&paymentMethod=${payment}&fromCart=${productId ? "0" : "1"}` as any,
    );
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
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={Colors.onSurface}
              />
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
        {address ? (
          <AddressCard address={address} />
        ) : (
          <Pressable
            onPress={() => router.push("/addresses" as any)}
            className="bg-surface-container-low rounded-xl p-4 flex-row items-center gap-3 active:opacity-80"
          >
            <View className="w-10 h-10 rounded-full bg-primary-fixed items-center justify-center">
              <MaterialIcons
                name="add-location-alt"
                size={22}
                color={Colors.primary}
              />
            </View>
            <View className="flex-1">
              <Text className="text-on-surface font-medium text-sm">
                添加收货地址
              </Text>
              <Text className="text-outline text-xs mt-0.5">
                请先添加收货地址再提交订单
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={Colors.outline}
            />
          </Pressable>
        )}

        {/* 订单商品 */}
        <View className="bg-surface-container-lowest rounded-xl px-4">
          {orderItems.map((item) => (
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
            <MaterialIcons
              name="card-giftcard"
              size={20}
              color={Colors.tertiary}
            />
            <Text className="text-on-surface text-sm">
              精美礼盒包装{" "}
              <Text className="text-tertiary font-medium">
                +¥{GIFT_BOX_PRICE}
              </Text>
            </Text>
          </View>
          <Switch
            value={giftBox}
            onValueChange={setGiftBox}
            trackColor={{
              true: Colors.primaryContainer,
              false: Colors.outlineVariant,
            }}
            thumbColor="#fff"
          />
        </View>

        {/* 价格明细 */}
        <PriceBreakdown
          subtotal={orderSubtotal}
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
          <Text className="text-on-primary font-medium text-base">
            提交订单
          </Text>
          <Text className="text-on-primary font-headline text-lg font-bold">
            ¥{total}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
