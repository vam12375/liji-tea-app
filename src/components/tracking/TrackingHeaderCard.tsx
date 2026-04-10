import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

import PaymentCountdown from "@/components/order/PaymentCountdown";
import { TrackingInfoRow } from "@/components/tracking/TrackingInfoRow";
import { trackingCopy } from "@/constants/copy";
import {
  formatDateTime,
  getDeliveryLabel,
  getDisplayOrderCode,
  type StatusMeta,
} from "@/lib/trackingUtils";
import type { Order } from "@/types/database";

interface TrackingHeaderCardProps {
  order: Order;
  statusMeta: StatusMeta;
  canRepay: boolean;
  remainingPaymentText: string | null;
  onPay: () => void;
  onCancel: () => void;
}

// 顶部卡片只处理订单状态总览、订单信息和待支付操作。
export function TrackingHeaderCard({
  order,
  statusMeta,
  canRepay,
  remainingPaymentText,
  onPay,
  onCancel,
}: TrackingHeaderCardProps) {
  return (
    <View
      className="gap-4 rounded-2xl p-5"
      style={{ backgroundColor: statusMeta.background }}
    >
      <View className="flex-row items-start gap-4">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${statusMeta.color}20` }}
        >
          <MaterialIcons
            name={statusMeta.icon as keyof typeof MaterialIcons.glyphMap}
            size={28}
            color={statusMeta.color}
          />
        </View>

        <View className="flex-1 gap-1">
          <Text className="text-2xl font-bold text-on-surface">
            {statusMeta.title}
          </Text>
          <Text className="text-sm leading-6 text-on-surface-variant">
            {statusMeta.description}
          </Text>
        </View>
      </View>

      <View className="gap-3 rounded-xl bg-background/80 p-4">
        <TrackingInfoRow
          label={trackingCopy.labels.orderNumber}
          value={getDisplayOrderCode(order.id, order.order_no)}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.orderedAt}
          value={formatDateTime(order.created_at)}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.deliveryType}
          value={getDeliveryLabel(order.delivery_type)}
        />

        {typeof order.coupon_discount === "number" && order.coupon_discount > 0 ? (
          <>
            <TrackingInfoRow
              label={trackingCopy.labels.coupon}
              value={
                order.coupon_title
                  ? `${order.coupon_title}${
                      order.coupon_code ? `（${order.coupon_code}）` : ""
                    }`
                  : order.coupon_code ?? trackingCopy.fallback.couponUsed
              }
            />
            <TrackingInfoRow
              label={trackingCopy.labels.couponDiscount}
              value={`-¥${order.coupon_discount.toFixed(2)}`}
            />
          </>
        ) : null}

        {order.notes ? (
          <TrackingInfoRow
            label={trackingCopy.labels.orderNote}
            value={order.notes}
          />
        ) : null}
      </View>

      {order.status === "pending" ? (
        <View className="gap-3 rounded-xl bg-background/80 p-4">
          <PaymentCountdown
            remainingText={remainingPaymentText}
            isPayable={canRepay}
          />

          <Pressable
            onPress={onPay}
            disabled={!canRepay}
            className={`items-center justify-center rounded-full py-3 ${
              canRepay
                ? "bg-primary-container active:bg-primary"
                : "bg-surface"
            }`}
          >
            <Text
              className={`font-medium ${
                canRepay ? "text-on-primary" : "text-outline"
              }`}
            >
              {trackingCopy.actions.payNow}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            className="items-center justify-center rounded-full border border-outline-variant py-3 active:opacity-70"
          >
            <Text className="font-medium text-outline">
              {trackingCopy.actions.cancel}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
