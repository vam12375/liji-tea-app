import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/Colors";
import { useOrderStore } from "@/stores/orderStore";
import { useCartStore } from "@/stores/cartStore";
import { showModal } from "@/stores/modalStore";

/** 支付方式配置映射 */
const PAYMENT_MAP: Record<string, { label: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  wechat: { label: "微信支付", icon: "account-balance-wallet", color: "#07C160" },
  alipay: { label: "支付宝", icon: "payments", color: "#1677FF" },
  card:   { label: "银行卡", icon: "credit-card", color: "#715b3e" },
};

/** 模拟处理过程中的提示文字 */
const PROGRESS_TEXTS = ["连接支付渠道...", "验证支付信息...", "处理交易中..."];

type PaymentPhase = "confirm" | "processing" | "success";

export default function PaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId, total, paymentMethod, fromCart } = useLocalSearchParams<{
    orderId: string;
    total: string;
    paymentMethod: string;
    fromCart?: string; // "1" 表示来自购物车
  }>();

  const { updateOrderStatus } = useOrderStore();
  const { clearCart } = useCartStore();

  const [phase, setPhase] = useState<PaymentPhase>("confirm");
  const [progressText, setProgressText] = useState(PROGRESS_TEXTS[0]);

  // 动画值
  const spinAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const methodInfo = PAYMENT_MAP[paymentMethod ?? "wechat"] ?? PAYMENT_MAP.wechat;
  const totalNum = parseFloat(total ?? "0");

  // --- 模拟处理动画：旋转 ---
  useEffect(() => {
    if (phase !== "processing") return;
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
  }, [phase, spinAnim]);

  // --- 成功阶段入场动画 ---
  useEffect(() => {
    if (phase !== "success") return;
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
  }, [phase, scaleAnim, fadeAnim]);

  /** 确认支付 → 开始模拟处理 */
  const handlePay = async () => {
    setPhase("processing");

    // 依次显示进度文字
    for (let i = 0; i < PROGRESS_TEXTS.length; i++) {
      setProgressText(PROGRESS_TEXTS[i]);
      await sleep(1000);
    }

    // 更新订单状态为 paid
    const { error } = await updateOrderStatus(orderId!, "paid");
    if (error) {
      setPhase("confirm");
      showModal("支付失败", error, "error");
      return;
    }

    // 购物车结算时清空购物车
    if (fromCart === "1") clearCart();

    setPhase("success");
  };

  /** 支付成功后完成 */
  const handleDone = () => {
    router.replace("/(tabs)" as any);
  };

  // 成功后 2 秒自动跳转
  useEffect(() => {
    if (phase !== "success") return;
    const timer = setTimeout(handleDone, 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: phase === "confirm",
          headerTitle: "确认支付",
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

      {/* ====== 阶段一：确认支付 ====== */}
      {phase === "confirm" && (
        <View className="flex-1 justify-between">
          <View className="items-center pt-12 px-6 gap-8">
            {/* 支付方式图标 */}
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: methodInfo.color + "18" }}
            >
              <MaterialIcons name={methodInfo.icon} size={32} color={methodInfo.color} />
            </View>

            {/* 支付金额 */}
            <View className="items-center gap-2">
              <Text className="text-outline text-sm">支付金额</Text>
              <Text
                className="text-on-surface font-bold"
                style={{ fontSize: 40, fontFamily: "Manrope_700Bold" }}
              >
                ¥ {totalNum.toFixed(2)}
              </Text>
            </View>

            {/* 订单信息摘要 */}
            <View className="w-full bg-surface-container-low rounded-xl p-4 gap-3">
              <InfoRow label="支付方式" value={methodInfo.label} />
              <InfoRow label="订单编号" value={orderId?.slice(0, 8) ?? "—"} />
              <InfoRow label="订单状态" value="待支付" />
            </View>
          </View>

          {/* 底部确认按钮 */}
          <View style={{ paddingBottom: insets.bottom || 16 }} className="px-4 pb-2">
            <Pressable
              onPress={handlePay}
              className="rounded-full py-4 items-center justify-center active:opacity-80"
              style={{ backgroundColor: methodInfo.color }}
            >
              <Text className="text-white font-medium text-base">
                确认支付 ¥{totalNum.toFixed(2)}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ====== 阶段二：处理中 ====== */}
      {phase === "processing" && (
        <View className="flex-1 items-center justify-center gap-6">
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <MaterialIcons name="autorenew" size={48} color={Colors.primaryContainer} />
          </Animated.View>
          <Text className="text-on-surface font-medium text-base">{progressText}</Text>
          <Text className="text-outline text-xs">请勿关闭页面</Text>
        </View>
      )}

      {/* ====== 阶段三：支付成功 ====== */}
      {phase === "success" && (
        <View className="flex-1 items-center justify-center gap-6 px-6">
          {/* 成功图标 — 弹性缩放入场 */}
          <Animated.View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{
              backgroundColor: "#07C16018",
              transform: [{ scale: scaleAnim }],
            }}
          >
            <MaterialIcons name="check-circle" size={48} color="#07C160" />
          </Animated.View>

          {/* 文字淡入 */}
          <Animated.View className="items-center gap-2" style={{ opacity: fadeAnim }}>
            <Text className="text-on-surface font-bold text-xl">支付成功</Text>
            <Text
              className="text-on-surface font-bold"
              style={{ fontSize: 32, fontFamily: "Manrope_700Bold" }}
            >
              ¥ {totalNum.toFixed(2)}
            </Text>
            <Text className="text-outline text-sm mt-2">
              订单号：{orderId?.slice(0, 8)}
            </Text>
          </Animated.View>

          {/* 手动完成按钮 */}
          <Animated.View className="w-full mt-8" style={{ opacity: fadeAnim }}>
            <Pressable
              onPress={handleDone}
              className="bg-primary-container rounded-full py-4 items-center active:bg-primary"
            >
              <Text className="text-on-primary font-medium text-base">完成</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/** 信息行组件 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-outline text-sm">{label}</Text>
      <Text className="text-on-surface text-sm font-medium">{value}</Text>
    </View>
  );
}

/** 工具：sleep */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
