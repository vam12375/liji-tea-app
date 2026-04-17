import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { MerchantStatusBadge } from "@/components/merchant/MerchantStatusBadge";
import { MerchantColors } from "@/constants/MerchantColors";
import { afterSaleStatusToTone } from "@/lib/merchantFilters";
import type { AfterSaleRequest } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  submitted: "待审核",
  pending_review: "待审核",
  auto_approved: "待审核",
  approved: "已同意",
  rejected: "已拒绝",
  refunding: "退款中",
  refunded: "已完成",
  cancelled: "已取消",
};

export function MerchantAfterSaleCard({
  request,
}: {
  request: AfterSaleRequest;
}) {
  const tone = afterSaleStatusToTone(request.status);
  const label = STATUS_LABEL[request.status] ?? request.status;
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/merchant/after-sale/[id]",
          params: { id: request.id },
        } as never)
      }
      style={({ pressed }) => [
        {
          marginHorizontal: 16,
          marginVertical: 6,
          padding: 16,
          borderRadius: 20,
          backgroundColor: MerchantColors.paper,
          borderColor: MerchantColors.line,
          borderWidth: 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            color: MerchantColors.ink900,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          申请 {request.id.slice(0, 8)}
        </Text>
        <MerchantStatusBadge tone={tone} label={label} />
      </View>
      <Text style={{ color: MerchantColors.ink500, fontSize: 12 }}>
        订单：{request.order_id?.slice?.(0, 8) ?? "-"}
      </Text>
      <Text style={{ color: MerchantColors.ink500, fontSize: 12, marginTop: 2 }}>
        申请金额：¥{request.requested_amount ?? "-"}
      </Text>
    </Pressable>
  );
}
