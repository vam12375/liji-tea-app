import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { Order } from "@/types/database";

// 商家端订单卡片：最简要信息（订单号 / 状态 / 时间 / 金额 / 收件人），
// 详情需要跳转到 /merchant/orders/[id]。

const STATUS_LABEL: Record<string, string> = {
  pending:   "待支付",
  paid:      "待发货",
  shipping:  "已发货",
  delivered: "已完成",
  cancelled: "已取消",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

export function MerchantOrderCard({ order }: { order: Order }) {
  const label = STATUS_LABEL[order.status] ?? order.status;
  const subtitle = [
    order.logistics_receiver_name || "未填写",
    order.logistics_receiver_phone || "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/merchant/orders/[id]", params: { id: order.id } } as never)}
      className="mx-4 my-2 p-4 rounded-2xl bg-surface-bright"
    >
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-on-surface text-sm font-semibold">
          {order.order_no ?? order.id.slice(0, 8)}
        </Text>
        <Text className="text-primary text-xs">{label}</Text>
      </View>
      <Text className="text-on-surface-variant text-xs mb-1">
        下单 {formatDate(order.created_at)}
      </Text>
      <View className="flex-row justify-between">
        <Text className="text-on-surface-variant text-xs" numberOfLines={1}>
          收件 {subtitle || "-"}
        </Text>
        <Text className="text-on-surface text-sm font-medium">¥{order.total ?? "-"}</Text>
      </View>
    </Pressable>
  );
}
