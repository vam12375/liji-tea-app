import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AddressCard from "@/components/checkout/AddressCard";
import DeliveryOptions from "@/components/checkout/DeliveryOptions";
import OrderItemCard from "@/components/checkout/OrderItemCard";
import PaymentMethods from "@/components/checkout/PaymentMethods";
import PriceBreakdown from "@/components/checkout/PriceBreakdown";
import { Colors } from "@/constants/Colors";
import { findDefaultItem } from "@/lib/collections";
import {
  getBestAvailableUserCouponId,
  getBestCouponRecommendation,
  getCouponDiscountDelta,
  getCouponScopeLabel,
} from "@/lib/couponSelection";
import { getEnabledPaymentChannels, isPaymentChannelEnabled } from "@/lib/paymentConfig";
import type { DeliveryType } from "@/lib/order";
import { routes } from "@/lib/routes";
import { useCheckoutPricing } from "@/hooks/useCheckoutPricing";
import { useCheckoutSubmit } from "@/hooks/useCheckoutSubmit";
import { useCartStore } from "@/stores/cartStore";
import { useCouponStore } from "@/stores/couponStore";
import { useOrderStore} from "@/stores/orderStore";
import { useProductStore } from "@/stores/productStore";
import { useUserStore } from "@/stores/userStore";
import type { PaymentChannel } from "@/types/payment";

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { productId, quantity: qtyParam } = useLocalSearchParams<{
    productId?: string;
    quantity?: string;
  }>();
  const {items: cartItems } = useCartStore();
  const session = useUserStore((state) => state.session);
  const address = useUserStore((state) => findDefaultItem(state.addresses) ?? null);
  const { createOrder } = useOrderStore();
  const products = useProductStore((state) => state.products);
const selectedUserCouponId = useCouponStore((state) => state.selectedUserCouponId);
  const userCoupons = useCouponStore((state) => state.userCoupons);
 const loadingUserCoupons = useCouponStore((state) => state.loadingUser);
const fetchUserCoupons = useCouponStore((state) => state.fetchUserCoupons);
  const setSelectedUserCouponId = useCouponStore((state) => state.setSelectedUserCouponId);
 const clearSelectedCoupon = useCouponStore((state) => state.clearSelectedCoupon);
  const enabledChannels = getEnabledPaymentChannels();

  const orderItems = useMemo(() => {
    if (productId) {
const product = products.find((item) => item.id === productId);
      if (product) {
        const qty = parseInt(qtyParam ?? "1", 10) || 1;
        return [{ product, quantity: qty }];
      }
    }

    return cartItems;
  }, [cartItems, productId, products, qtyParam]);

  const requestItems = useMemo(
    () =>
      orderItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    [orderItems],
  );

  const couponContextItems = useMemo(
    () =>
      orderItems.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
 category: item.product.category,
        quantity: item.quantity,
        unitPrice: item.product.price,
      })),
    [orderItems],
  );

  const [delivery, setDelivery] = useState<DeliveryType>("standard");
  const [payment, setPayment] = useState<PaymentChannel>(
    enabledChannels[0] ?? "alipay",
  );
  const [note, setNote] = useState("");
  const [giftBox, setGiftBox] = useState(false);

const { pricing, pricingLoading, pricingError } = useCheckoutPricing({
    items: requestItems,
    deliveryType: delivery,
    giftWrap: giftBox,
selectedUserCouponId,
  });

  const selectedCoupon = useMemo(
    () => userCoupons.find((item) => item.id === selectedUserCouponId) ?? null,
    [selectedUserCouponId, userCoupons],
  );
  const availableCouponCount = useMemo(
    () => userCoupons.filter((item) => item.status === "available").length,
    [userCoupons],
  );
  const couponDescription = useMemo(() => {
    if (!session) {
      return "登录后可领取并使用优惠券";
    }

    if (selectedCoupon?.coupon) {
      const code = selectedCoupon.coupon.code?.trim();
      return code
        ? `${selectedCoupon.coupon.title} · ${code}`
        : selectedCoupon.coupon.title;
    }

    if (loadingUserCoupons) {
      return "正在加载可用优惠券...";
    }

    if (availableCouponCount > 0) {
      return `${availableCouponCount} 张可用，系统将自动为你选择最优券`;
    }

    return "暂无可用优惠券";
  }, [availableCouponCount, loadingUserCoupons, selectedCoupon, session]);

  const bestCouponRecommendation = useMemo(
    () =>
      getBestCouponRecommendation(userCoupons, {
        subtotal: pricing?.subtotal ?? 0,
 shipping: pricing?.shipping ?? 0,
        autoDiscount: pricing?.autoDiscount ?? 0,
        items: couponContextItems,
      }),
    [
      couponContextItems,
      pricing?.autoDiscount,
      pricing?.shipping,
      pricing?.subtotal,
      userCoupons,
    ],
  );

  const betterCouponHint = useMemo(
    () =>
      getCouponDiscountDelta(userCoupons, selectedUserCouponId, {
        subtotal: pricing?.subtotal ?? 0,
        shipping: pricing?.shipping ?? 0,
        autoDiscount: pricing?.autoDiscount ?? 0,
        items: couponContextItems,
      }),
    [
      couponContextItems,
      pricing?.autoDiscount,
 pricing?.shipping,
      pricing?.subtotal,
      selectedUserCouponId,
      userCoupons,
    ],
  );

  const selectedCouponScopeText = useMemo(() => {
    if (!selectedCoupon?.coupon) {
      return null;
    }

    return getCouponScopeLabel(selectedCoupon.coupon, couponContextItems);
  }, [couponContextItems, selectedCoupon]);

  const betterCouponTitle = useMemo(() => {
    if (!betterCouponHint) {
      return null;
    }

    return userCoupons.find((item) => item.id === betterCouponHint.bestUserCouponId)?.coupon?.title ?? null;
  }, [betterCouponHint, userCoupons]);

  useEffect(() => {
    if (!isPaymentChannelEnabled(payment)) {
      setPayment(enabledChannels[0] ?? "alipay");
    }
  }, [enabledChannels, payment]);

  useEffect(() => {
    if (session) {
 void fetchUserCoupons();
    }
  }, [fetchUserCoupons, session]);

  useEffect(() => {
    if (!session || loadingUserCoupons || requestItems.length === 0) {
      return;
    }

    if (selectedUserCouponId) {
      return;
    }

    const bestCouponId = getBestAvailableUserCouponId(userCoupons, {
      subtotal: pricing?.subtotal ?? 0,
      shipping: pricing?.shipping ?? 0,
      autoDiscount: pricing?.autoDiscount ?? 0,
      items: couponContextItems,
    });

 if (bestCouponId) {
      setSelectedUserCouponId(bestCouponId);
    }
  }, [
    couponContextItems,
    loadingUserCoupons,
    pricing?.autoDiscount,
    pricing?.shipping,
    pricing?.subtotal,
    requestItems.length,
    selectedUserCouponId,
    session,
    setSelectedUserCouponId,
    userCoupons,
  ]);

  const handleSubmit = useCheckoutSubmit({
    router,
    session,
    address,
    requestItems,
    delivery,
    payment,
note,
    giftBox,
    selectedUserCouponId,
    pricingLoading,
    pricingError,
    productId,
    createOrder,
    clearSelectedCoupon,
  });

  const submitDisabled =
    requestItems.length === 0 ||
    pricingLoading ||
    !!pricingError ||
    !pricing ||
    enabledChannels.length === 0 ||
    !isPaymentChannelEnabled(payment);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "确认订单",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: {backgroundColor: Colors.background },
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
        {address ? (
          <Pressable onPress={() => router.push(routes.addresses)} className="active:opacity-80">
            <AddressCard address={address} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push(routes.addresses)}
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

        <View className="bg-surface-container-lowest rounded-xl px-4">
          {orderItems.map((item) => (
            <OrderItemCard key={item.product.id} item={item} />
          ))}
        </View>

        <DeliveryOptions
          selected={delivery}
          onSelect={(value) => setDelivery(value as DeliveryType)}
        />

        <PaymentMethods selected={payment} onSelect={setPayment} />

        <Pressable
          onPress={() => {
            if (!session) {
router.push(routes.login);
              return;
            }

            router.push("./coupons?mode=select");
          }}
          className="bg-surface-container-low rounded-xl px-4 py-3 active:opacity-80"
        >
          <View className="flex-row items-center gap-3">
            <MaterialIcons
              name="local-offer"
              size={20}
              color={selectedCoupon ? Colors.primary : Colors.tertiary}
            />
            <View className="flex-1">
              <Text className="text-on-surface text-sm font-medium">优惠券</Text>
              <Text className="text-outline text-xs mt-0.5">{couponDescription}</Text>
              {selectedCouponScopeText ? (
                <Text className="text-outline text-xs mt-1">{selectedCouponScopeText}</Text>
              ) : null}
              {pricing?.appliedCoupon ? (
                <Text className="text-primary text-xs mt-1">
                  已自动匹配最优券，本单已优惠 ¥{pricing.appliedCoupon.discountAmount.toFixed(2)}
                </Text>
              ) : null}
              {betterCouponHint && betterCouponTitle ? (
                <Text className="text-tertiary text-xs mt-1">
                  还有更省的券可用：{betterCouponTitle}，可再省 ¥{betterCouponHint.delta.toFixed(2)}
                </Text>
              ) : null}
            </View>
            {session && !selectedCoupon && availableCouponCount > 0 ? (
              <View className="min-w-5 h-5 rounded-full bg-primary items-center justify-center px-1">
                <Text className="text-[10px] font-bold text-white">
                  {availableCouponCount > 99 ? "99+" : availableCouponCount}
                </Text>
              </View>
            ) : null}
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </View>
        </Pressable>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="备注：请轻拿轻放..."
          placeholderTextColor={Colors.outline}
          className="bg-surface-container-low rounded-xl px-4 py-3 text-sm text-on-surface"
          multiline
        />

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
                {giftBox && pricing
                  ? `+¥${pricing.giftWrapFee.toFixed(2)}`
                  : "系统计价"}
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

        <View className="bg-surface-container-low rounded-xl p-4 gap-3">
          <Text className="text-on-surface text-sm font-medium">价格明细</Text>
          {pricing ? (
            <PriceBreakdown
              subtotal={pricing.subtotal}
              shipping={pricing.shipping}
              discount={pricing.discount}
              autoDiscount={pricing.autoDiscount}
              couponDiscount={pricing.couponDiscount}
              couponTitle={pricing.appliedCoupon?.title ?? null}
              couponCode={pricing.appliedCoupon?.code ?? null}
              couponScopeLabel={
                pricing.appliedCoupon
                  ? getCouponScopeLabel(pricing.appliedCoupon, couponContextItems)
                  : null
              }
 giftWrapFee={pricing.giftWrapFee}
            />
          ) : (
            <Text className="text-outline text-sm leading-6">
              {pricingLoading
                ? "正在向服务端计算订单金额..."
                : pricingError ?? "暂无可展示的订单金额"}
            </Text>
          )}
          <Text className="text-outline text-xs leading-5">
            订单金额、运费和优惠均以服务端实时计算结果为准。
          </Text>
        </View>
      </ScrollView>

      <View
        style={{ paddingBottom: insets.bottom || 16 }}
        className="absolute bottom-0 left-0 right-0 bg-background/95 border-t border-outline-variant/10 px-4 pt-3"
>
        <Pressable
          onPress={handleSubmit}
          disabled={submitDisabled}
          className="rounded-full py-4 flex-row items-center justify-center gap-4 active:opacity-80"
          style={{
            backgroundColor: submitDisabled
              ? Colors.outlineVariant
              : Colors.primaryContainer,
          }}
        >
          <Text className="text-on-primary font-medium text-base">
            {pricingLoading ? "金额计算中..." : "提交订单"}
          </Text>
          <Text className="text-on-primary font-headline text-lg font-bold">
            ¥{pricing ? pricing.total.toFixed(2) : "--"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
