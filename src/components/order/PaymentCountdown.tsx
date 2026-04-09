import { Text, View } from "react-native";

import { getPendingPaymentCopy } from "@/constants/copy";

/** 支付倒计时组件的输入参数，统一接收是否可支付与剩余时间文案。 */
interface PaymentCountdownProps {
  remainingText: string | null;
  isPayable: boolean;
}

/**
 * 统一渲染待支付订单的倒计时提示卡片。
 * 订单列表页和物流页都可以复用这块 UI，避免各自维护相同文案和布局。
 */
export default function PaymentCountdown({
  remainingText,
  isPayable,
}: PaymentCountdownProps) {
  // 倒计时相关的固定文案统一从常量层读取，便于后续继续做多语言或运营文案调整。
  const copy = getPendingPaymentCopy();

  return (
    <View className="rounded-xl bg-background px-3 py-3 gap-1">
      <Text className="text-on-surface text-sm font-medium">
        {isPayable && remainingText
          ? `请在 ${remainingText} 内完成支付`
          : copy.expiredTitle}
      </Text>
      <Text className="text-outline text-xs leading-5">{copy.description}</Text>
    </View>
  );
}
