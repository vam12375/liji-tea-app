import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { createAlipayOrder, waitForPaymentConfirmation } from "@/lib/alipay";
import { invokeAlipayAppPay, isAlipayNativeModuleAvailable } from "@/lib/alipayNative";
import { Colors } from "@/constants/Colors";
import { useCartStore } from "@/stores/cartStore";
import { showModal } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import type { AlipayNativePayResult } from "@/types/payment";

const PAYMENT_MAP: Record<
  string,
  { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }
> = {
  wechat: { label: "微信支付", icon: "account-balance-wallet", color: "#07C160" },
  alipay: { label: "支付宝", icon: "payments", color: "#1677FF" },
  card: { label: "银行卡", icon: "credit-card", color: "#715b3e" },
};

type PaymentPhase =
  | "confirm"
  | "creating_order"
  | "invoking_sdk"
  | "waiting_confirm"
  | "success"
  | "failed";

const PROCESSING_PHASE_TEXT: Record<
  Exclude<PaymentPhase, "confirm" | "success" | "failed">,
  string
> = {
  creating_order: "正在向服务端创建支付宝支付单...",
  invoking_sdk: "正在唤起支付宝客户端...",
  waiting_confirm: "支付已发起，正在等待服务端确认...",
};

function parseAmount(value?: string) {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

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
  const [nativeResult, setNativeResult] = useState<AlipayNativePayResult | null>(
    null
  );

  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const selectedMethod = paymentMethod ?? "alipay";
  const methodInfo = PAYMENT_MAP[selectedMethod] ?? PAYMENT_MAP.alipay;
  const hasNativeModule = isAlipayNativeModuleAvailable();
  const isProcessing =
    phase === "creating_order" ||
    phase === "invoking_sdk" ||
    phase === "waiting_confirm";
  const processingText = isProcessing
    ? PROCESSING_PHASE_TEXT[phase as keyof typeof PROCESSING_PHASE_TEXT]
    : "";

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
      })
    );

    loop.start();
    return () => loop.stop();
  }, [isProcessing, spinAnim]);

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

  useEffect(() => {
    if (phase !== "success") {
      return;
    }

    const timer = setTimeout(() => {
      router.replace("/orders?initialTab=paid" as any);
    }, 2000);

    return () => clearTimeout(timer);
  }, [phase, router]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handlePay = async () => {
    if (!orderId) {
      showModal("支付失败", "缺少订单编号，无法发起支付。", "error");
      setFailureMessage("缺少订单编号，无法发起支付。");
      setPhase("failed");
      return;
    }

    if (selectedMethod !== "alipay") {
      showModal("暂未开放", "当前版本仅接入支付宝沙箱支付。");
      return;
    }

    setFailureMessage(null);
    setNativeResult(null);

    try {
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

      if (sdkResult.resultStatus !== "9000" && sdkResult.resultStatus !== "8000") {
        throw new Error(
          sdkResult.memo || `支付宝 SDK 返回了未完成状态：${sdkResult.resultStatus}`
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
          paymentStatus.paymentErrorMessage || "服务端确认支付失败，请稍后重试。"
        );
      }

      throw new Error("暂未收到服务端成功确认，请稍后在订单列表中刷新查看。");
    } catch (error) {
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

      {phase === "confirm" && (
        <View className="flex-1 justify-between">
          <View className="items-center pt-12 px-6 gap-8">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: methodInfo.color + "18" }}
            >
              <MaterialIcons name={methodInfo.icon} size={32} color={methodInfo.color} />
            </View>

            <View className="items-center gap-2">
              <Text className="text-outline text-sm">支付金额</Text>
              <Text
                className="text-on-surface font-bold"
                style={{ fontSize: 40, fontFamily: "Manrope_700Bold" }}
              >
                ¥ {displayAmount.toFixed(2)}
              </Text>
            </View>

            <View className="w-full bg-surface-container-low rounded-xl p-4 gap-3">
              <InfoRow label="支付方式" value={methodInfo.label} />
              <InfoRow label="订单编号" value={orderId?.slice(0, 8) ?? "—"} />
              <InfoRow label="订单状态" value="待支付" />
              {outTradeNo && (
                <InfoRow label="支付单号" value={outTradeNo.slice(-12)} />
              )}
            </View>

            <View className="w-full bg-surface-container-low rounded-xl p-4 gap-2">
              <Text className="text-on-surface text-sm font-medium">
                支付结果说明
              </Text>
              <Text className="text-outline text-xs leading-5">
                最终支付结果以服务端验签后的订单状态为准，客户端不会再直接写入
                `paid`。
              </Text>
              {!hasNativeModule && (
                <Text className="text-outline text-xs leading-5">
                  当前开发包还没有接入支付宝原生模块，本次改造已先接通服务端支付单创建和状态确认链路。
                </Text>
              )}
            </View>
          </View>

          <View style={{ paddingBottom: insets.bottom || 16 }} className="px-4 pb-2">
            <Pressable
              onPress={handlePay}
              className="rounded-full py-4 items-center justify-center active:opacity-80"
              style={{ backgroundColor: methodInfo.color }}
            >
              <Text className="text-white font-medium text-base">
                确认支付 ¥{displayAmount.toFixed(2)}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {isProcessing && (
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
              {phase === "invoking_sdk"
                ? "支付宝客户端返回结果后，仍会继续等待服务端验签确认。"
                : "请勿关闭页面，支付状态会在服务端确认后更新。"}
            </Text>
          </View>

          <View className="w-full bg-surface-container-low rounded-xl p-4 gap-3">
            <InfoRow label="订单编号" value={orderId?.slice(0, 8) ?? "—"} />
            <InfoRow label="支付金额" value={`¥ ${displayAmount.toFixed(2)}`} />
            {outTradeNo && <InfoRow label="支付单号" value={outTradeNo} />}
          </View>
        </View>
      )}

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

          <Animated.View className="items-center gap-2" style={{ opacity: fadeAnim }}>
            <Text className="text-on-surface font-bold text-xl">支付成功</Text>
            <Text
              className="text-on-surface font-bold"
              style={{ fontSize: 32, fontFamily: "Manrope_700Bold" }}
            >
              ¥ {displayAmount.toFixed(2)}
            </Text>
            <Text className="text-outline text-sm mt-2">
              订单号：{orderId?.slice(0, 8)}
            </Text>
            {outTradeNo && (
              <Text className="text-outline text-xs">支付单号：{outTradeNo}</Text>
            )}
          </Animated.View>

          <Animated.View className="w-full mt-8" style={{ opacity: fadeAnim }}>
            <Pressable
              onPress={() => router.replace("/orders?initialTab=paid" as any)}
              className="bg-primary-container rounded-full py-4 items-center active:bg-primary"
            >
              <Text className="text-on-primary font-medium text-base">
                查看订单
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {phase === "failed" && (
        <View className="flex-1 justify-between px-6 py-10">
          <View className="items-center gap-6 pt-8">
            <View className="w-20 h-20 rounded-full bg-error/10 items-center justify-center">
              <MaterialIcons name="error-outline" size={44} color={Colors.error} />
            </View>

            <View className="items-center gap-2">
              <Text className="text-on-surface text-xl font-bold">支付未完成</Text>
              <Text className="text-outline text-sm text-center leading-6">
                {failureMessage ?? "支付失败，请稍后重试。"}
              </Text>
            </View>

            <View className="w-full bg-surface-container-low rounded-xl p-4 gap-3">
              <InfoRow label="订单编号" value={orderId?.slice(0, 8) ?? "—"} />
              <InfoRow label="支付金额" value={`¥ ${displayAmount.toFixed(2)}`} />
              {outTradeNo && <InfoRow label="支付单号" value={outTradeNo} />}
              {nativeResult?.resultStatus && (
                <InfoRow label="SDK 状态" value={nativeResult.resultStatus} />
              )}
            </View>
          </View>

          <View style={{ paddingBottom: insets.bottom || 16 }} className="gap-3">
            <Pressable
              onPress={handlePay}
              className="bg-primary-container rounded-full py-4 items-center active:bg-primary"
            >
              <Text className="text-on-primary font-medium text-base">
                重新发起支付
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace("/orders?initialTab=pending" as any)}
              className="rounded-full py-4 items-center border border-outline-variant active:opacity-80"
            >
              <Text className="text-on-surface font-medium text-base">返回订单</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center gap-4">
      <Text className="text-outline text-sm">{label}</Text>
      <Text className="text-on-surface text-sm font-medium flex-1 text-right">
        {value}
      </Text>
    </View>
  );
}
