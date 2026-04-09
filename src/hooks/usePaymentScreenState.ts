import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import{ Animated, Easing } from "react-native";

import {
  isPaymentChannel,
  PAYMENT_MAP,
  parseAmount,
  PROCESSING_PHASE_TEXT,
} from "@/components/payment";
import { getPaymentResultCopy, paymentCopy }from "@/constants/copy";
import type { PaymentPhase } from "@/constants/payment";
import { isAlipayNativeModuleAvailable } from "@/lib/alipayNative";
import { executePaymentByChannel } from "@/lib/paymentFlow";
import {
  isPaymentChannelEnabled,
  paymentChannelConfig,
} from "@/lib/paymentConfig";
import { showModal } from "@/stores/modalStore";
import type { AlipayNativePayResult, PaymentChannel } from "@/types/payment";

interface UsePaymentScreenStateParams {
  orderId?: string;
  total?: string;
  paymentMethod?: string;
  fromCart?: string;
  onCartClear: () => void;
  onOrdersRefresh: () => Promise<void>;
}

// 支付页所有阶段展示与触发逻辑都从这里统一编排，避免页面组件直接耦合支付细节。
export function usePaymentScreenState({
  orderId,
  total,
  paymentMethod,
  fromCart,
  onCartClear,
  onOrdersRefresh,
}: UsePaymentScreenStateParams) {
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
  const methodInfo =PAYMENT_MAP[selectedMethod];
  const channelEnabled = isPaymentChannelEnabled(selectedMethod);
  const isMockChannel = paymentChannelConfig[selectedMethod].isMock;
  const hasNativeModule = isAlipayNativeModuleAvailable();
  const requiresNativeSdk = selectedMethod === "alipay";
  const canStartPayment = channelEnabled && (!requiresNativeSdk || hasNativeModule);

  const displayPhase = phase === "idle" ? "confirm" : phase;
  const isProcessing =
    displayPhase === "creating_order" ||
    displayPhase === "invoking_sdk" ||
    displayPhase === "waiting_confirm";
  const processingText = isProcessing ? PROCESSING_PHASE_TEXT[displayPhase] : "";
  const amountText = useMemo(() => `¥ ${displayAmount.toFixed(2)}`, [displayAmount]);
  const orderCode = orderId?.slice(0, 8) ?? "—";
  const paymentResultCopy = getPaymentResultCopy(isMockChannel ? "mock" : "alipay");

  const headerTitle =
    displayPhase === "failed"
      ? paymentCopy.titles.failed
      : displayPhase === "success"
        ?paymentCopy.titles.success
        : paymentCopy.titles.confirm;
  const showBackButton = displayPhase === "confirm" || displayPhase === "failed";

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

  useEffect(() => {
    if (displayPhase !== "success") {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:1,
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

  const handlePay = useCallback(async () => {
    // 发起支付前先在前端做一轮快速失败保护，避免无效请求进入后端链路。
    if (!orderId) {
      const message =paymentCopy.messages.missingOrderId;
      showModal(paymentCopy.titles.failed, message, "error");
      setFailureMessage(message);
      setPhase("failed");
      return;
    }

    if (!channelEnabled) {
      const message =paymentCopy.messages.channelDisabled;
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
          setPhase(nextPhase === "idle" ? "confirm" : nextPhase);
        },
        onAmountUpdate: (amount) => {
          setDisplayAmount(amount);
        },
        onTradeNoUpdate: (tradeNo) => {
          setOutTradeNo(tradeNo);
        },
        onNativeResult: (resultValue) => {
          setNativeResult(resultValue);
        },
        onCartClear: async () => {
          onCartClear();
        },
        onOrdersRefresh: async () => {
          await onOrdersRefresh();
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
    fromCart,
    hasNativeModule,
    onCartClear,
    onOrdersRefresh,
    orderId,
    selectedMethod,
  ]);

  const handleRetry = useCallback(() => {
    void handlePay();
  },[handlePay]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return {
    amountText,
    canStartPayment,
    channelEnabled,
    displayAmount,
    displayPhase,
    failureMessage,
    handlePay,
    handleRetry,
    hasNativeModule,
    headerTitle,
    isProcessing,
    methodInfo,
    nativeResult,
    orderCode,
    outTradeNo,
    paymentResultCopy,
    processingText,
    selectedMethod,
    showBackButton,
    spin,
scaleAnim,
    fadeAnim,
  };
}
