import { View, Text } from "react-native";

interface PriceBreakdownProps {
  subtotal: number;
  shipping: number;
  discount: number;
  giftBox: boolean;
}

export default function PriceBreakdown({
  subtotal,
  shipping,
  discount,
  giftBox,
}: PriceBreakdownProps) {
  const giftBoxPrice = giftBox ? 28 : 0;
  const total = subtotal + shipping - discount + giftBoxPrice;

  return (
    <View className="gap-3">
      <Row label="商品小计" value={`¥${subtotal}`} />
      <Row label="运费" value={shipping === 0 ? "免费" : `¥${shipping}`} />
      {discount > 0 && (
        <Row label="优惠" value={`-¥${discount}`} valueClass="text-primary font-bold" />
      )}
      {giftBox && <Row label="礼盒包装" value={`+¥${giftBoxPrice}`} />}
      <View className="h-px bg-outline-variant/20 my-1" />
      <View className="flex-row justify-between items-center">
        <Text className="text-on-surface font-medium">合计</Text>
        <Text className="font-headline text-primary text-2xl font-bold">
          ¥{total}
        </Text>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  valueClass = "text-on-surface",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-outline text-sm">{label}</Text>
      <Text className={`text-sm ${valueClass}`}>{value}</Text>
    </View>
  );
}
