import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";

import { Colors } from "@/constants/Colors";
import { trackingCopy } from "@/constants/copy";
import { maskPhone } from "@/lib/trackingUtils";
import type { Order } from "@/types/database";

interface TrackingAddressCardProps {
  order: Order;
}

// 收货信息卡单独抽离后，页面主体无需再关心地址判空与脱敏细节。
export function TrackingAddressCard({ order }: TrackingAddressCardProps) {
  return (
    <View className="gap-3 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons
          name="location-on"
          size={18}
          color={Colors.primaryContainer}
        />
        <Text className="text-base font-bold text-on-surface">
          {trackingCopy.sections.address}
        </Text>
      </View>

      {order.address ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-medium text-on-surface">
              {order.address.name}
            </Text>
            <Text className="text-xs text-outline">
              {maskPhone(order.address.phone)}
            </Text>
          </View>
          <Text className="text-sm leading-6 text-on-surface-variant">
            {order.address.address}
          </Text>
        </View>
      ) : (
        <Text className="text-sm text-outline">
          {trackingCopy.fallback.noAddress}
        </Text>
      )}
    </View>
  );
}
