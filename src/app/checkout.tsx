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
import { getEnabledPaymentChannels, isPaymentChannelEnabled } from "@/lib/paymentConfig";
import {
  quoteOrder,
  type DeliveryType,
  type OrderPricingQuote,
} from "@/lib/order";
import { routes } from "@/lib/routes";
import { useCartStore } from "@/stores/cartStore";
import { useCouponStore } from "@/stores/couponStore";
import { showModal } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import { useProductStore } from "@/stores/productStore";
import { useUserStore } from "@/stores/userStore";
import type { PaymentChannel } from "@/types/payment";

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { items: cartItems } = useCartStore();
  const session = useUserStore((state) => state.session);
  const getDefaultAddress = useUserStore((state) => state.getDefaultAddress);
  const { createOrder } = useOrderStore();
  const products = useProductStore((state) => state.products);
  const selectedUserCouponId = useCouponStore((state) => state.selectedUserCouponId);
  const userCoupons = useCouponStore((state) => state.userCoupons);
  const loadingUserCoupons = useCouponStore((state) => state.loadingUser);
  const fetchUserCoupons = useCouponStore((state) => state.fetchUserCoupons);
  const clearSelectedCoupon = useCouponStore((state) => state.clearSelectedCoupon);
  const enabledChannels = getEnabledPaymentChannels();

  // productId 存在时表示直接购买，否则沿用购物车里的待结算商品。
  const orderItems = useMemo(() => {
    if (productId) {
      const product = products.find((item) => item.id === productId);
      if (product) {
        return [{ product, quantity: 1 }];
      }
    }

    return cartItems;
  }, [cartItems, productId, products]);

  // 结算相关接口只需要商品 id 和数量，这里把页面数据收敛成请求体结构。
  const requestItems = useMemo(
    () =>
      orderItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    [orderItems],
  );

  const [delivery, setDelivery] = useState<DeliveryType>("standard");
  const [payment, setPayment] = useState<PaymentChannel>(
    enabledChannels[0] ?? "alipay",
  );
  const [note, setNote] = useState("");
  const [giftBox, setGiftBox] = useState(false);
  const [pricing, setPricing] = useState<OrderPricingQuote | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const address = getDefaultAddress();
  // 从用户优惠券列表中派生当前选中项和提示文案，避免渲染层重复判断。
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
      return `${availableCouponCount} 张可用，点击选择`;
    }

    return "暂无可用优惠券";
  }, [availableCouponCount, loadingUserCoupons, selectedCoupon, session]);

  // 如果当前选中的支付方式被环境配置关闭，则自动回退到首个可用渠道。
  useEffect(() => {
    if (!isPaymentChannelEnabled(payment)) {
      setPayment(enabledChannels[0] ?? "alipay");
    }
  }, [enabledChannels, payment]);

  // 登录后拉取用户已领取的优惠券，供结算页选择和实时询价使用。
  useEffect(() => {
    if (session) {
      void fetchUserCoupons();
    }
  }, [fetchUserCoupons, session]);

  // 所有影响价格的条件变化后都重新走服务端询价，前端不自行信任本地金额。
  useEffect(() => {
    if (requestItems.length === 0) {
      setPricing(null);
      setPricingError("暂无可结算商品");
      setPricingLoading(false);
      return;
    }

    let cancelled = false;
    setPricingLoading(true);
    setPricingError(null);

    quoteOrder({
      items: requestItems,
      deliveryType: delivery,
      giftWrap: giftBox,
      userCouponId: selectedUserCouponId ?? undefined,
    })
      .then((quote) => {
        if (!cancelled) {
          setPricing(quote);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setPricing(null);
        setPricingError(
          error instanceof Error ? error.message : "获取订单金额失败",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setPricingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [delivery, giftBox, requestItems, selectedUserCouponId]);

  // 正式下单前再次校验登录态、地址、支付渠道与最新询价结果。
  const handleSubmit = async () => {
    if (!session) {
      router.push(routes.login);
      return;
    }

    if (enabledChannels.length === 0 || !isPaymentChannelEnabled(payment)) {
      showModal("暂不可下单", "当前环境未启用有效的支付渠道。", "error");
      return;
    }

    if (requestItems.length === 0) {
      showModal("提示", "当前暂无可结算商品");
      return;
    }

    if (!address) {
      showModal("提示", "请先添加收货地址");
      return;
    }

    if (pricingLoading) {
      showModal(
        "请稍候",
        "订单金额正在由服务端计算，请稍后再提交。",
      );
      return;
    }

    if (pricingError) {
      showModal("订单失败", pricingError, "error");
      return;
    }

    const { order, error } = await createOrder({
      items: requestItems,
      addressId: address.id,
      deliveryType: delivery,
      paymentMethod: payment,
      notes: note || undefined,
      giftWrap: giftBox,
      userCouponId: selectedUserCouponId ?? undefined,
    });

    if (error || !order) {
      showModal("订单失败", error ?? "创建订单失败", "error");
      return;
    }

    clearSelectedCoupon();

    router.replace(
      routes.payment({
        orderId: order.orderId,
        total: order.total.toFixed(2),
        paymentMethod: payment,
        fromCart: productId ? "0" : "1",
      }),
    );
  };

  // 只有在服务端金额已准备完成且支付渠道可用时才允许提交订单。
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
        {address ? (
          <AddressCard address={address} />
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

        {/* 优惠券入口只负责选择 user_coupon，真正是否可用仍由服务端在询价/下单时校验。 */}
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
              {pricing?.appliedCoupon ? (
                <Text className="text-primary text-xs mt-1">
                  本单已优惠 ¥{pricing.appliedCoupon.discountAmount.toFixed(2)}
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

        {/* 价格明细完全基于服务端返回结构渲染，避免本地金额与订单实际金额不一致。 */}
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
