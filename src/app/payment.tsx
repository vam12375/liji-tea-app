import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InfoRow } from "@/components/payment";
import { AppHeader } from "@/components/ui/AppHeader";
import { Colors } from "@/constants/Colors";
import { getConfirmPaymentButtonText, paymentCopy } from"@/constants/copy";
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

  const{
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
  } = usePaymentScreenState({
    orderId,
    total,
    paymentMethod,
    fromCart,
    onCartClear: clearCart,
    onOrdersRefresh: fetchOrders,
  });

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
    <View className="flex-1 bg-background">
      <AppHeader title={headerTitle} showBackButton={showBackButton} />

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
              {selectedMethod === "alipay" && !hasNativeModule ?(
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
                  :paymentCopy.messages.waitingForServerConfirm
                : paymentCopy.messages.mockSuccessHint}
            </Text>
          </View>

          <View className="w-full gap-3 rounded-xl bg-surface-container-low p-4">
            <InfoRow label={paymentCopy.labels.orderNumber}value={orderCode} />
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
            className="h-20 w-20 items-center justify-centerrounded-full"
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

      {displayPhase === "failed" ?(
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
              className="items-centerrounded-full border border-outline-variant py-4 active:opacity-80"
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
