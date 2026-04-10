import { View, Text } from "react-native";

// 价格明细组件直接消费服务端返回的拆单金额字段，不自行定义额外计价规则。
interface PriceBreakdownProps {
  subtotal: number;
  shipping: number;
  discount: number;
  autoDiscount?: number;
  couponDiscount?: number;
  couponTitle?: string | null;
  couponCode?: string | null;
  couponScopeLabel?: string | null;
  giftWrapFee: number;
}

// 将活动优惠、优惠券抵扣、运费和礼盒费拆开展示，便于用户核对金额来源。
export default function PriceBreakdown({
  subtotal,
  shipping,
  discount,
  autoDiscount = 0,
  couponDiscount = 0,
  couponTitle,
  couponCode,
  couponScopeLabel,
  giftWrapFee,
}: PriceBreakdownProps) {
  // 合计金额沿用服务端同样的计算结构，只负责展示不改变业务规则。
  const total = subtotal + shipping - discount + giftWrapFee;
  const couponLabel = couponTitle?.trim()
    ? `优惠券 · ${couponTitle.trim()}`
    : couponCode?.trim()
      ? `优惠券 · ${couponCode.trim()}`
      : "优惠券";

  return (
    <View className="gap-3">
      <Row label="商品小计" value={`¥${subtotal.toFixed(2)}`} />
      <Row label="运费" value={shipping === 0 ? "免费" : `¥${shipping.toFixed(2)}`} />
      {autoDiscount > 0 && (
        <Row
          label="活动优惠"
          value={`-¥${autoDiscount.toFixed(2)}`}
          valueClass="text-primary font-bold"
        />
      )}
      {couponDiscount > 0 && (
        <View className="gap-1">
          <Row
            label={couponLabel}
            value={`-¥${couponDiscount.toFixed(2)}`}
            valueClass="text-primary font-bold"
          />
          {couponScopeLabel ? (
            <Text className="text-outline text-xs">{couponScopeLabel}</Text>
          ) : null}
        </View>
      )}
      {discount > 0 && autoDiscount <= 0 && couponDiscount <= 0 && (
        <Row label="优惠" value={`-¥${discount.toFixed(2)}`} valueClass="text-primary font-bold" />
      )}
      {giftWrapFee > 0 && <Row label="礼盒包装" value={`+¥${giftWrapFee.toFixed(2)}`} />}
      <View className="h-px bg-outline-variant/20 my-1" />
      <View className="flex-row justify-between items-center">
        <Text className="text-on-surface font-medium">合计</Text>
        <Text className="font-headline text-primary text-2xl font-bold">
          ¥{total.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

// 统一渲染每一行价格项，保持对齐和文本样式一致。
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
