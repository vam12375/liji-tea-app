import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PaymentMethods from "@/components/checkout/PaymentMethods";
import { InfoRow } from "@/components/payment";
import { AppHeader } from "@/components/ui/AppHeader";
import { Colors } from "@/constants/Colors";
import { getConfirmPaymentButtonText, paymentCopy } from "@/constants/copy";
import { usePaymentScreenState } from "@/hooks/usePaymentScreenState";
import { routes } from "@/lib/routes";
import { useCartStore } from "@/stores/cartStore";
import { useOrderStore } from "@/stores/orderStore";

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

  const {
    amountText,
    canStartPayment,
    channelEnabled,
    displayAmount,
    displayPhase,
    failureMessage,
    fadeAnim,
    handlePay,
    handleRetry,
    handleSelectMethod,
    hasNativeModule,
    headerTitle,
    isProcessing,
    methodInfo,
    nativeResult,
    orderCode,
    outTradeNo,
    paymentResultCopy,
    processingText,
    scaleAnim,
    selectedMethod,
    showBackButton,
    spin,
  } = usePaymentScreenState({
    orderId,
    total,
    paymentMethod,
    fromCart,
    onCartClear: clearCart,
    onOrdersRefresh: fetchOrders,
  });

  // 待付款补付时允许改选支付方式，确认态和失败态共用同一块选择区。
  const paymentMethodSelector = (
    <View className="w-full rounded-xl bg-surface-container-low p-4">
      <PaymentMethods selected={selectedMethod} onSelect={handleSelectMethod} />
    </View>
  );

  useEffect(() => {
    if (displayPhase !== "success") {
      return;
    }

    const timer = setTimeout(() => {
      router.replace(routes.ordersTab("paid"));
    }, 2000);

    return () => clearTimeout(timer);
  }, [displayPhase, router]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppHeader title={headerTitle} showBackButton={showBackButton} />

      {displayPhase === "confirm" ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-12"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-8">
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

            {paymentMethodSelector}

            <View className="w-full gap-3 rounded-xl bg-surface-container-low p-4">
              <InfoRow label={paymentCopy.labels.paymentMethod} value={methodInfo.label} />
              <InfoRow label={paymentCopy.labels.orderNumber} value={orderCode} />
              <InfoRow
                label={paymentCopy.labels.orderStatus}
                value={paymentCopy.labels.orderPendingStatus}
              />
              {outTradeNo ? (
                <InfoRow
                  label={paymentCopy.labels.tradeNumber}
                  value={outTradeNo.slice(-12)}
                />
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
            <View className="w-full pt-3">
              <Pressable
                onPress={handlePay}
                disabled={!canStartPayment}
                className="items-center justify-center rounded-full py-4 active:opacity-80"
                style={{
                  backgroundColor: canStartPayment
                    ? methodInfo.color
                    : Colors.outlineVariant,
                }}
              >
                <Text className="text-base font-medium text-white">
                  {getConfirmPaymentButtonText(displayAmount)}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      ) : null}

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
            <Text className="text-xl font-bold text-on-surface">
              {paymentCopy.titles.success}
            </Text>
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

      {displayPhase === "failed" ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pt-8"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-6">
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

            {paymentMethodSelector}

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
            <View className="w-full gap-3 pt-3">
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
        </ScrollView>
      ) : null}
    </KeyboardAvoidingView>
  );
}
