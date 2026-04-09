import { Text, View } from "react-native";

import { ORDER_STATUS_BADGE_MAP } from "@/constants/order";
import type { Order } from "@/types/database";

/** 页面只传入订单状态即可得到统一样式的徽章，避免每页重复写颜色映射。 */
interface OrderStatusBadgeProps {
  status: Order["status"];
}

/**
 * 统一订单状态徽章组件，供订单列表、物流详情等页面复用。
 * 具体颜色和文案由常量层集中维护，组件本身只负责渲染。
 */
export default function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  // 根据订单状态读取对应的颜色和文案配置。
  const badge = ORDER_STATUS_BADGE_MAP[status];

  return (
    <View
      className="rounded-full px-2 py-0.5"
      style={{ backgroundColor: badge.backgroundColor }}
    >
      <Text className="text-xs font-medium" style={{ color: badge.color }}>
        {badge.label}
      </Text>
    </View>
  );
}
