import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";

import { TrackingInfoRow } from "@/components/tracking/TrackingInfoRow";
import { Colors } from "@/constants/Colors";
import { trackingCopy } from "@/constants/copy";
import {
  formatDateTime,
  getLogisticsStatusLabel,
} from "@/lib/trackingUtils";
import type { Order } from "@/types/database";
import type { MockLogisticsAction } from "@/types/payment";

interface TrackingActionsCardProps {
  order: Order;
  canAdvanceLogistics: boolean;
  canConfirmReceive: boolean;
  actionLoading: MockLogisticsAction | null;
  onAdvanceLogistics: () => void;
  onConfirmReceive: () => void;
}

// 物流动作卡把“物流信息展示”和“订单动作按钮”放在同一处。
export function TrackingActionsCard({
  order,
  canAdvanceLogistics,
  canConfirmReceive,
  actionLoading,
  onAdvanceLogistics,
  onConfirmReceive,
}: TrackingActionsCardProps) {
  return (
    <View className="gap-4 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons
          name="local-shipping"
          size={18}
          color={Colors.primaryContainer}
        />
        <Text className="text-base font-bold text-on-surface">
          {trackingCopy.sections.logistics}
        </Text>
      </View>

      <View className="gap-3 rounded-xl bg-background px-3 py-3">
        <TrackingInfoRow
          label={trackingCopy.labels.logisticsCompany}
          value={order.logistics_company ?? trackingCopy.fallback.mockCompany}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.trackingNumber}
          value={
            order.logistics_tracking_no ??
            trackingCopy.fallback.trackingNumberPending
          }
        />
        <TrackingInfoRow
          label={trackingCopy.labels.logisticsStatus}
          value={getLogisticsStatusLabel(order.logistics_status)}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.shippedAt}
          value={formatDateTime(order.shipped_at)}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.deliveredAt}
          value={formatDateTime(order.delivered_at)}
        />
      </View>

      {canAdvanceLogistics ? (
        <Pressable
          onPress={onAdvanceLogistics}
          disabled={actionLoading !== null}
          className="items-center justify-center rounded-full bg-primary-container py-3 active:bg-primary"
        >
          <Text className="font-medium text-on-primary">
            {actionLoading
              ? trackingCopy.actions.advancingLogistics
              : trackingCopy.actions.advanceLogistics}
          </Text>
        </Pressable>
      ) : null}

      {canConfirmReceive ? (
        <Pressable
          onPress={onConfirmReceive}
          className="items-center justify-center rounded-full bg-primary-container py-3 active:bg-primary"
        >
          <Text className="font-medium text-on-primary">
            {trackingCopy.actions.confirmReceive}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
