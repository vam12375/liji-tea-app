import { View, Text } from "react-native";

interface OrderSummaryProps {
  subtotal: number;
  shipping: number;
  discount: number;
}

export default function OrderSummary({
  subtotal,
  shipping,
  discount,
}: OrderSummaryProps) {
  const total = subtotal + shipping - discount;

  return (
    <View className="bg-surface-container-low rounded-xl p-4 gap-3">
      <SummaryRow label="小计" value={`¥${subtotal}`} />
      <SummaryRow
        label="运费"
        value={shipping === 0 ? "¥0" : `¥${shipping}`}
        badge={shipping === 0 ? "包邮" : undefined}
      />
      {discount > 0 && (
        <SummaryRow
          label="优惠"
          value={`-¥${discount}`}
          valueColor="text-error"
          badge={`已优惠¥${discount}`}
        />
      )}
      <View className="h-px bg-outline-variant/20 my-1" />
      <View className="flex-row justify-between items-center">
        <Text className="text-on-surface font-medium">合计</Text>
        <Text className="text-primary text-xl font-bold">¥{total}</Text>
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  valueColor = "text-on-surface",
  badge,
}: {
  label: string;
  value: string;
  valueColor?: string;
  badge?: string;
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-outline text-sm">{label}</Text>
      <View className="flex-row items-center gap-2">
        {badge && (
          <View className="bg-tertiary-fixed/30 px-2 py-0.5 rounded">
            <Text className="text-tertiary text-[10px]">{badge}</Text>
          </View>
        )}
        <Text className={`${valueColor} text-sm`}>{value}</Text>
      </View>
    </View>
  );
}
