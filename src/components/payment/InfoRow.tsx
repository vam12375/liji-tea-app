import { Text, View } from "react-native";

/** 统一渲染支付信息行，保持各阶段订单摘要的布局一致。 */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center gap-4">
      <Text className="text-outline text-sm">{label}</Text>
      <Text className="text-on-surface text-sm font-medium flex-1 text-right">
        {value}
      </Text>
    </View>
  );
}
