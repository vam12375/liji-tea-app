import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { AfterSaleRequest } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  submitted:      "待审核",
  pending_review: "待审核",
  auto_approved:  "待审核",
  approved:       "已同意",
  rejected:       "已拒绝",
  refunding:      "退款中",
  refunded:       "已完成",
  cancelled:      "已取消",
};

export function MerchantAfterSaleCard({ request }: { request: AfterSaleRequest }) {
  const label = STATUS_LABEL[request.status] ?? request.status;
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/merchant/after-sale/[id]",
          params: { id: request.id },
        } as never)
      }
      className="mx-4 my-2 p-4 rounded-2xl bg-surface-bright"
    >
      <View className="flex-row justify-between mb-1">
        <Text className="text-on-surface font-semibold">
          申请 {request.id.slice(0, 8)}
        </Text>
        <Text className="text-primary text-xs">{label}</Text>
      </View>
      <Text className="text-on-surface-variant text-xs">
        订单：{request.order_id?.slice?.(0, 8) ?? "-"}
      </Text>
      <Text className="text-on-surface-variant text-xs">
        申请金额：¥{request.requested_amount ?? "-"}
      </Text>
    </Pressable>
  );
}
