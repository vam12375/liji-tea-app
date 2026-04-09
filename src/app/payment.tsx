import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  InfoRow,
  isPaymentChannel,
  PAYMENT_MAP,
  parseAmount,
  PROCESSING_PHASE_TEXT,
} from "@/components/payment";
import AppHeader from "@/components/ui/AppHeader";
import { Colors } from "@/constants/Colors";
import {
  getConfirmPaymentButtonText,
  getPaymentResultCopy,
  paymentCopy,
} from "@/constants/copy";
import type { PaymentPhase } from "@/constants/payment";
import { isAlipayNativeModuleAvailable } from "@/lib/alipayNative";
import { executePaymentByChannel } from "@/lib/paymentFlow";
import { isPaymentChannelEnabled, paymentChannelConfig } from "@/lib/paymentConfig";
import { routes } from "@/lib/routes";
import { useCartStore } from "@/stores/cartStore";
import { showModal } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import type { AlipayNativePayResult, PaymentChannel } from "@/types/payment";

/**
 * 支付页负责串起“确认支付 -> 创建支付单 -> 唤起客户端 -> 等待服务端确认 -> 结果展示”的完整流程。
 * 当前页面改为消费 [`executePaymentByChannel()`](src/lib/paymentFlow.ts:288) 这套轻量状态机，
 * 自身只保留 UI 状态展示和少量运行环境前置校验。
 */
export default function PaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId, total, paymentMethod, fromCart } = useLocalSearchParams<{
    orderId: string;
    total?: string;
    paymentMethod?: string;
    fromCart?: string;
  }>();

  const fetchOrders = useOrderStore((state) => state.fetchOrders);
  const clearCart = useCartStore((state) => state.clearCart);

  const [phase, setPhase] = useState<PaymentPhase>("confirm");
  const [displayAmount, setDisplayAmount] = useState(() => parseAmount(total));
  const [outTradeNo, setOutTradeNo] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [nativeResult, setNativeResult] = useState<AlipayNativePayResult | null>(null);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 路由参数可能被外部构造，这里统一校验后再进入支付流程。
  const selectedMethod: PaymentChannel = isPaymentChannel(paymentMethod)
    ? paymentMethod
    : "alipay";
  const methodInfo = PAYMENT_MAP[selectedMethod];
  const channelEnabled = isPaymentChannelEnabled(selectedMethod);
  const isMockChannel = paymentChannelConfig[selectedMethod].isMock;
  const hasNativeModule = isAlipayNativeModuleAvailable();
  const requiresNativeSdk = selectedMethod === "alipay";
  const canStartPayment = channelEnabled && (!requiresNativeSdk || hasNativeModule);

  // 状态机内部会先发出 idle；页面展示层将其折叠为 confirm，避免出现额外中间态。
  const displayPhase = phase === "idle" ? "confirm" : phase;
  const isProcessing =
    displayPhase === "creating_order" ||
    displayPhase === "invoking_sdk" ||
    displayPhase === "waiting_confirm";
  const processingText = isProcessing ? PROCESSING_PHASE_TEXT[displayPhase] : "";
  const amountText = useMemo(() => `¥ ${displayAmount.toFixed(2)}`, [displayAmount]);
  const orderCode = orderId?.slice(0, 8) ?? "—";
  const paymentResultCopy = getPaymentResultCopy(isMockChannel ? "mock" : "alipay");

  // 页面头标题跟随支付阶段切换，但统一复用通用导航头组件。
  const headerTitle =
    displayPhase === "failed"
      ? paymentCopy.titles.failed
      : displayPhase === "success"
        ? paymentCopy.titles.success
        : paymentCopy.titles.confirm;
  const showBackButton = displayPhase === "confirm" || displayPhase === "failed";

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
    if (displayPhase !== "success") {
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
  }, [displayPhase, fadeAnim, scaleAnim]);

  // 成功页短暂停留后自动跳转到已支付订单列表。
  useEffect(() => {
    if (displayPhase !== "success") {
      return;
    }

    const timer = setTimeout(() => {
      router.replace(routes.ordersTab("paid"));
    }, 2000);

    return () => clearTimeout(timer);
  }, [displayPhase, router]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  /**
   * 点击支付按钮后仅处理运行环境前置判断，并将真正的支付状态推进交给状态机入口。
   * 这样支付宝与 mock 支付都能复用一套统一的 phase、埋点与错误处理流程。
   */
  const handlePay = useCallback(async () => {
    if (!orderId) {
      const message = paymentCopy.messages.missingOrderId;
      showModal(paymentCopy.titles.failed, message, "error");
      setFailureMessage(message);
      setPhase("failed");
      return;
    }

    if (!channelEnabled) {
      const message = paymentCopy.messages.channelDisabled;
      showModal(paymentCopy.modalTitles.cannotStart, message, "error");
      setFailureMessage(message);
      setPhase("failed");
      return;
    }

    if (selectedMethod === "alipay" && !hasNativeModule) {
      const message =
        "当前 Android 开发包未集成支付宝原生 SDK，请先放入 AAR、执行 prebuild，并使用 Dev Client 或原生包调试。";
      showModal(paymentCopy.modalTitles.cannotStart, message, "error");
      setFailureMessage(message);
      setPhase("failed");
      return;
    }

    setFailureMessage(null);
    setOutTradeNo(null);
    setNativeResult(null);

    const result = await executePaymentByChannel(
      orderId,
      selectedMethod,
      channelEnabled,
      fromCart === "1",
      {
        onPhaseChange: (nextPhase) => {
          // 对页面 UI 来说，idle 与 confirm 等价，这里直接收敛到确认页展示态。
          setPhase(nextPhase === "idle" ? "confirm" : nextPhase);
        },
        onAmountUpdate: (amount) => {
          setDisplayAmount(amount);
        },
        onTradeNoUpdate: (tradeNo) => {
          setOutTradeNo(tradeNo);
        },
        onNativeResult: (result) => {
          setNativeResult(result);
        },
        onCartClear: async () => {
          clearCart();
        },
        onOrdersRefresh: async () => {
          await fetchOrders();
        },
      },
    );

    if (!result.success) {
      const message = result.message ?? paymentCopy.messages.fallbackFailed;
      setFailureMessage(message);
      showModal(paymentCopy.titles.failed, message, "error");
    }
  }, [
    channelEnabled,
    clearCart,
    fetchOrders,
    fromCart,
    hasNativeModule,
    orderId,
    selectedMethod,
  ]);

  /** 失败页继续支持重试，直接复用统一支付入口。 */
  const handleRetry = useCallback(() => {
    void handlePay();
  }, [handlePay]);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={headerTitle} showBackButton={showBackButton} />

      {/* 确认阶段只展示订单与支付方式信息，尚未真正发起支付。 */}
      {displayPhase === "confirm" ? (
        <View className="flex-1 justify-between">
          <View className="items-center gap-8 px-6 pt-12">
            <View
              className="h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${methodInfo.color}18` }}
            >
              <MaterialIcons
                name={methodInfo.icon}
                size={32}
                color={methodInfo.color}
              />
            </View>

            <View className="items-center gap-2">
              <Text className="text-sm text-outline">{paymentCopy.labels.amount}</Text>
              <Text
                className="font-bold text-on-surface"
                style={{ fontSize: 40, fontFamily: "Manrope_700Bold" }}
              >
                {amountText}
              </Text>
            </View>

            <View className="w-full gap-3 rounded-xl bg-surface-container-low p-4">
              <InfoRow label={paymentCopy.labels.paymentMethod} value={methodInfo.label} />
              <InfoRow label={paymentCopy.labels.orderNumber} value={orderCode} />
              <InfoRow
                label={paymentCopy.labels.orderStatus}
                value={paymentCopy.labels.orderPendingStatus}
              />
              {outTradeNo ? (
                <InfoRow label={paymentCopy.labels.tradeNumber} value={outTradeNo.slice(-12)} />
              ) : null}
            </View>

            <View className="w-full gap-2 rounded-xl bg-surface-container-low p-4">
              <Text className="text-sm font-medium text-on-surface">
                {paymentCopy.titles.result}
              </Text>
              <Text className="text-xs leading-5 text-outline">{paymentResultCopy}</Text>
              {!channelEnabled ? (
                <Text className="text-xs leading-5 text-error">
                  {paymentCopy.messages.channelDisabled}
                </Text>
              ) : null}
              {selectedMethod === "alipay" && !hasNativeModule ? (
                <Text className="text-xs leading-5 text-outline">
                  当前开发包尚未集成支付宝原生模块，本页不会继续发起真实 App 支付。
                </Text>
              ) : null}
            </View>
          </View>

          <View className="px-4 pb-2" style={{ paddingBottom: insets.bottom || 16 }}>
            <Pressable
              onPress={handlePay}
              disabled={!canStartPayment}
              className="items-center justify-center rounded-full py-4 active:opacity-80"
              style={{
                backgroundColor: canStartPayment ? methodInfo.color : Colors.outlineVariant,
              }}
            >
              <Text className="text-base font-medium text-white">
                {getConfirmPaymentButtonText(displayAmount)}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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
            <Text className="text-center text-base font-medium text-on-surface">
              {processingText}
            </Text>
            <Text className="text-center text-xs leading-5 text-outline">
              {selectedMethod === "alipay"
                ? displayPhase === "invoking_sdk"
                  ? paymentCopy.messages.waitingAfterSdk
                  : paymentCopy.messages.waitingForServerConfirm
                : paymentCopy.messages.mockSuccessHint}
            </Text>
          </View>

          <View className="w-full gap-3 rounded-xl bg-surface-container-low p-4">
            <InfoRow label={paymentCopy.labels.orderNumber} value={orderCode} />
            <InfoRow label={paymentCopy.labels.amount} value={amountText} />
            {outTradeNo ? (
              <InfoRow label={paymentCopy.labels.tradeNumber} value={outTradeNo} />
            ) : null}
          </View>
        </View>
      ) : null}

      {/* 成功阶段展示支付结果摘要，并提供跳转订单列表入口。 */}
      {displayPhase === "success" ? (
        <View className="flex-1 items-center justify-center gap-6 px-6">
          <Animated.View
            className="h-20 w-20 items-center justify-center rounded-full"
            style={{
              backgroundColor: "#07C16018",
              transform: [{ scale: scaleAnim }],
            }}
          >
            <MaterialIcons name="check-circle" size={48} color="#07C160" />
          </Animated.View>

          <Animated.View className="items-center gap-2" style={{ opacity: fadeAnim }}>
            <Text className="text-xl font-bold text-on-surface">{paymentCopy.titles.success}</Text>
            <Text
              className="font-bold text-on-surface"
              style={{ fontSize: 32, fontFamily: "Manrope_700Bold" }}
            >
              {amountText}
            </Text>
            <Text className="mt-2 text-sm text-outline">
              {paymentCopy.labels.orderNumber}：{orderCode}
            </Text>
            {outTradeNo ? (
              <Text className="text-xs text-outline">
                {paymentCopy.labels.tradeNumber}：{outTradeNo}
              </Text>
            ) : null}
          </Animated.View>

          <Animated.View className="mt-8 w-full" style={{ opacity: fadeAnim }}>
            <Pressable
              onPress={() => router.replace(routes.ordersTab("paid"))}
              className="items-center rounded-full bg-primary-container py-4 active:bg-primary"
            >
              <Text className="text-base font-medium text-on-primary">
                {paymentCopy.buttons.viewOrders}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      {/* 失败阶段保留错误信息和重试入口，方便用户继续支付或返回订单。 */}
      {displayPhase === "failed" ? (
        <View className="flex-1 justify-between px-6 py-10">
          <View className="items-center gap-6 pt-8">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-error/10">
              <MaterialIcons
                name="error-outline"
                size={44}
                color={Colors.error}
              />
            </View>

            <View className="items-center gap-2">
              <Text className="text-xl font-bold text-on-surface">
                {paymentCopy.titles.incomplete}
              </Text>
              <Text className="text-center text-sm leading-6 text-outline">
                {failureMessage ?? paymentCopy.messages.fallbackFailed}
              </Text>
            </View>

            <View className="w-full gap-3 rounded-xl bg-surface-container-low p-4">
              <InfoRow label={paymentCopy.labels.orderNumber} value={orderCode} />
              <InfoRow label={paymentCopy.labels.amount} value={amountText} />
              {outTradeNo ? (
                <InfoRow label={paymentCopy.labels.tradeNumber} value={outTradeNo} />
              ) : null}
              {nativeResult?.resultStatus ? (
                <InfoRow
                  label={paymentCopy.labels.sdkStatus}
                  value={nativeResult.resultStatus}
                />
              ) : null}
            </View>
          </View>

          <View className="gap-3" style={{ paddingBottom: insets.bottom || 16 }}>
            <Pressable
              onPress={handleRetry}
              className="items-center rounded-full bg-primary-container py-4 active:bg-primary"
            >
              <Text className="text-base font-medium text-on-primary">
                {paymentCopy.buttons.retry}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace(routes.ordersTab("pending"))}
              className="items-center rounded-full border border-outline-variant py-4 active:opacity-80"
            >
              <Text className="text-base font-medium text-on-surface">
                {paymentCopy.buttons.backToOrders}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
