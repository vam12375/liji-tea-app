import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  InfoRow,
  isPaymentChannel,
  PAYMENT_MAP,
  type PaymentPhase,
  parseAmount,
  PROCESSING_PHASE_TEXT,
} from "@/components/payment";
import { Colors } from "@/constants/Colors";
import { createAlipayOrder, waitForPaymentConfirmation } from "@/lib/alipay";
import {
  invokeAlipayAppPay,
  isAlipayNativeModuleAvailable,
} from "@/lib/alipayNative";
import { isPaymentChannelEnabled, paymentChannelConfig } from "@/lib/paymentConfig";
import { confirmMockPayment } from "@/lib/payment";
import { routes } from "@/lib/routes";
import { useCartStore } from "@/stores/cartStore";
import { showModal } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import type { AlipayNativePayResult, PaymentChannel } from "@/types/payment";

// 支付页负责串起客户端拉起支付与服务端确认状态的完整链路。
export default function PaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId, total, paymentMethod, fromCart } = useLocalSearchParams<{
    orderId: string;
    total?: string;
    paymentMethod?: string;
    fromCart?: string;
  }>();

  const { fetchOrders } = useOrderStore();
  const { clearCart } = useCartStore();

  const [phase, setPhase] = useState<PaymentPhase>("confirm");
  const [displayAmount, setDisplayAmount] = useState(() => parseAmount(total));
  const [outTradeNo, setOutTradeNo] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [nativeResult, setNativeResult] =
    useState<AlipayNativePayResult | null>(null);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const selectedMethod: PaymentChannel = isPaymentChannel(paymentMethod)
    ? paymentMethod
    : "alipay";
  const methodInfo = PAYMENT_MAP[selectedMethod];
  const channelEnabled = isPaymentChannelEnabled(selectedMethod);
  const isMockChannel = paymentChannelConfig[selectedMethod].isMock;
  const hasNativeModule = isAlipayNativeModuleAvailable();
  const requiresNativeSdk = selectedMethod === "alipay";
  const canStartPayment = channelEnabled && (!requiresNativeSdk || hasNativeModule);
  const isProcessing =
    phase === "creating_order" ||
    phase === "invoking_sdk" ||
    phase === "waiting_confirm";
  const processingText = isProcessing
    ? PROCESSING_PHASE_TEXT[phase as keyof typeof PROCESSING_PHASE_TEXT]
    : "";

  // 处理中展示旋转动画，离开处理中阶段后立即重置动画状态。
  useEffect(() => {
    if (!isProcessing) {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [isProcessing, spinAnim]);

  // 支付成功后播放勾选动画，强化支付完成反馈。
  useEffect(() => {
    if (phase !== "success") {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, phase, scaleAnim]);

  // 成功页短暂停留后自动跳转到已支付订单列表。
  useEffect(() => {
    if (phase !== "success") {
      return;
    }

    const timer = setTimeout(() => {
      router.replace(routes.ordersTab("paid"));
    }, 2000);

    return () => clearTimeout(timer);
  }, [phase, router]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // 发起支付时统一处理真实支付宝链路与模拟支付链路，并最终以服务端状态为准。
  const handlePay = async () => {
    if (!orderId) {
      const message = "缺少订单编号，无法发起支付。";
      showModal("支付失败", message, "error");
      setFailureMessage(message);
      setPhase("failed");
      return;
    }

    if (!channelEnabled) {
      const message = "当前支付渠道未启用，请返回订单页重新选择。";
      showModal("无法发起支付", message, "error");
      setFailureMessage(message);
      setPhase("failed");
      return;
    }

    if (selectedMethod === "alipay" && !hasNativeModule) {
      const message =
        "当前 Android 开发包未集成支付宝原生 SDK，请先放入 AAR、执行 prebuild，并使用 Dev Client 或原生包调试。";
      showModal("无法发起支付", message, "error");
      setFailureMessage(message);
      setPhase("failed");
      return;
    }

    setFailureMessage(null);
    setNativeResult(null);

    try {
      if (selectedMethod === "alipay") {
        setPhase("creating_order");
        const createResult = await createAlipayOrder(orderId);
        setDisplayAmount(parseAmount(createResult.amount));
        setOutTradeNo(createResult.outTradeNo);

        setPhase("invoking_sdk");
        const sdkResult = await invokeAlipayAppPay(createResult.orderString);
        setNativeResult(sdkResult);

        if (sdkResult.resultStatus === "6001") {
          throw new Error("你已取消本次支付宝支付。");
        }

        if (
          sdkResult.resultStatus !== "9000" &&
          sdkResult.resultStatus !== "8000"
        ) {
          throw new Error(
            sdkResult.memo ||
              `支付宝 SDK 返回了未完成状态：${sdkResult.resultStatus}`,
          );
        }

        setPhase("waiting_confirm");
        const paymentStatus = await waitForPaymentConfirmation(orderId);

        if (
          paymentStatus.status === "paid" ||
          paymentStatus.paymentStatus === "success"
        ) {
          if (fromCart === "1") {
            clearCart();
          }

          await fetchOrders();
          setPhase("success");
          return;
        }

        if (paymentStatus.paymentStatus === "closed") {
          throw new Error("支付单已关闭，请返回订单页后重新发起支付。");
        }

        if (paymentStatus.paymentStatus === "failed") {
          throw new Error(
            paymentStatus.paymentErrorMessage || "服务端确认支付失败，请稍后重试。",
          );
        }

        throw new Error("暂未收到服务端成功确认，请稍后在订单列表中刷新查看。");
      }

      if (!isMockChannel) {
        throw new Error("当前支付渠道未接入可用的客户端支付实现。");
      }

      setPhase("creating_order");
      const mockResult = await confirmMockPayment(orderId);
      setOutTradeNo(mockResult.outTradeNo);
      if (mockResult.paidAmount !== null) {
        setDisplayAmount(mockResult.paidAmount);
      }

      if (fromCart === "1") {
        clearCart();
      }

      await fetchOrders();
      setPhase("success");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "支付失败，请稍后重试。";
      setFailureMessage(message);
      setPhase("failed");
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: phase === "confirm" || phase === "failed",
          headerTitle: phase === "failed" ? "支付失败" : "确认支付",
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

      {/* 确认阶段只展示订单与支付方式信息，尚未真正发起支付。 */}
      {phase === "confirm" && (
        <View className="flex-1 justify-between">
          <View className="items-center pt-12 px-6 gap-8">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: `${methodInfo.color}18` }}
            >
              <MaterialIcons
                name={methodInfo.icon}
                size={32}
                color={methodInfo.color}
              />
            </View>

            <View className="items-center gap-2">
              <Text className="text-outline text-sm">支付金额</Text>
              <Text
                className="text-on-surface font-bold"
                style={{ fontSize: 40, fontFamily: "Manrope_700Bold" }}
              >
                楼 {displayAmount.toFixed(2)}
              </Text>
            </View>

            <View className="w-full bg-surface-container-low rounded-xl p-4 gap-3">
              <InfoRow label="支付方式" value={methodInfo.label} />
              <InfoRow label="订单编号" value={orderId?.slice(0, 8) ?? "—"} />
              <InfoRow label="订单状态" value="待支付" />
              {outTradeNo ? (
                <InfoRow label="支付单号" value={outTradeNo.slice(-12)} />
              ) : null}
            </View>

            <View className="w-full bg-surface-container-low rounded-xl p-4 gap-2">
              <Text className="text-on-surface text-sm font-medium">
                支付结果说明
              </Text>
              <Text className="text-outline text-xs leading-5">
                {selectedMethod === "alipay"
                  ? "最终支付结果以服务端验签后的订单状态为准，客户端不会直接写入 paid。"
                  : "当前支付方式为后端模拟支付，支付成功后由服务端直接更新订单状态。"}
              </Text>
              {!channelEnabled ? (
                <Text className="text-error text-xs leading-5">
                  当前渠道未启用，请返回订单页重新选择。
                </Text>
              ) : null}
              {selectedMethod === "alipay" && !hasNativeModule ? (
                <Text className="text-outline text-xs leading-5">
                  当前开发包尚未集成支付宝原生模块，本页不会继续发起真实 App 支付。
                </Text>
              ) : null}
            </View>
          </View>

          <View
            style={{ paddingBottom: insets.bottom || 16 }}
            className="px-4 pb-2"
          >
            <Pressable
              onPress={handlePay}
              disabled={!canStartPayment}
              className="rounded-full py-4 items-center justify-center active:opacity-80"
              style={{
                backgroundColor: canStartPayment
                  ? methodInfo.color
                  : Colors.outlineVariant,
              }}
            >
              <Text className="text-white font-medium text-base">
                确认支付 楼{displayAmount.toFixed(2)}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 处理中阶段强调“等待服务端确认”，避免用户误以为 SDK 返回即支付成功。 */}
      {isProcessing ? (
        <View className="flex-1 items-center justify-center gap-6 px-6">
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <MaterialIcons
              name="autorenew"
              size={48}
              color={Colors.primaryContainer}
            />
          </Animated.View>

          <View className="items-center gap-2">
            <Text className="text-on-surface font-medium text-base text-center">
              {processingText}
            </Text>
            <Text className="text-outline text-xs text-center leading-5">
              {selectedMethod === "alipay"
                ? phase === "invoking_sdk"
                  ? "支付客户端返回结果后，仍会继续等待服务端验签确认。"
                  : "请勿关闭页面，支付状态会在服务端确认后更新。"
                : "模拟支付成功后，订单会由后端直接更新为待发货。"}
            </Text>
          </View>

          <View className="w-full bg-surface-container-low rounded-xl p-4 gap-3">
            <InfoRow label="订单编号" value={orderId?.slice(0, 8) ?? "—"} />
            <InfoRow label="支付金额" value={`楼 ${displayAmount.toFixed(2)}`} />
            {outTradeNo ? (
              <InfoRow label="支付单号" value={outTradeNo} />
            ) : null}
          </View>
        </View>
      ) : null}

      {/* 成功阶段展示支付结果摘要，并提供跳转订单列表入口。 */}
      {phase === "success" && (
        <View className="flex-1 items-center justify-center gap-6 px-6">
          <Animated.View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{
              backgroundColor: "#07C16018",
              transform: [{ scale: scaleAnim }],
            }}
          >
            <MaterialIcons name="check-circle" size={48} color="#07C160" />
          </Animated.View>

          <Animated.View
            className="items-center gap-2"
            style={{ opacity: fadeAnim }}
          >
            <Text className="text-on-surface font-bold text-xl">支付成功</Text>
            <Text
              className="text-on-surface font-bold"
              style={{ fontSize: 32, fontFamily: "Manrope_700Bold" }}
            >
              楼 {displayAmount.toFixed(2)}
            </Text>
            <Text className="text-outline text-sm mt-2">
              订单号：{orderId?.slice(0, 8)}
            </Text>
            {outTradeNo ? (
              <Text className="text-outline text-xs">
                支付单号：{outTradeNo}
              </Text>
            ) : null}
          </Animated.View>

          <Animated.View className="w-full mt-8" style={{ opacity: fadeAnim }}>
            <Pressable
              onPress={() => router.replace(routes.ordersTab("paid"))}
              className="bg-primary-container rounded-full py-4 items-center active:bg-primary"
            >
              <Text className="text-on-primary font-medium text-base">
                查看订单
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* 失败阶段保留错误信息和重试入口，方便用户继续支付或返回订单。 */}
      {phase === "failed" && (
        <View className="flex-1 justify-between px-6 py-10">
          <View className="items-center gap-6 pt-8">
            <View className="w-20 h-20 rounded-full bg-error/10 items-center justify-center">
              <MaterialIcons
                name="error-outline"
                size={44}
                color={Colors.error}
              />
            </View>

            <View className="items-center gap-2">
              <Text className="text-on-surface text-xl font-bold">
                支付未完成
              </Text>
              <Text className="text-outline text-sm text-center leading-6">
                {failureMessage ?? "支付失败，请稍后重试。"}
              </Text>
            </View>

            <View className="w-full bg-surface-container-low rounded-xl p-4 gap-3">
              <InfoRow label="订单编号" value={orderId?.slice(0, 8) ?? "—"} />
              <InfoRow
                label="支付金额"
                value={`楼 ${displayAmount.toFixed(2)}`}
              />
              {outTradeNo ? (
                <InfoRow label="支付单号" value={outTradeNo} />
              ) : null}
              {nativeResult?.resultStatus ? (
                <InfoRow label="SDK 状态" value={nativeResult.resultStatus} />
              ) : null}
            </View>
          </View>

          <View
            style={{ paddingBottom: insets.bottom || 16 }}
            className="gap-3"
          >
            <Pressable
              onPress={handlePay}
              className="bg-primary-container rounded-full py-4 items-center active:bg-primary"
            >
              <Text className="text-on-primary font-medium text-base">
                重新发起支付
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace(routes.ordersTab("pending"))}
              className="rounded-full py-4 items-center border border-outline-variant active:opacity-80"
            >
              <Text className="text-on-surface font-medium text-base">
                返回订单
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
