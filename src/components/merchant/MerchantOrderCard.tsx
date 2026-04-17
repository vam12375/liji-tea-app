import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { MerchantStatusBadge } from "@/components/merchant/MerchantStatusBadge";
import { MerchantColors } from "@/constants/MerchantColors";
import { orderStatusToTone } from "@/lib/merchantFilters";
import type { Order } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  pending: "待支付",
  paid: "待发货",
  shipping: "已发货",
  delivered: "已完成",
  cancelled: "已取消",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return value;
  }
}

// 订单列表卡片：纸白底 + 1px 米线（不再阴影），顶行订单号 + 状态徽标 + 金额；
// 中间下单时间与收件人；底部新增商品缩略行，帮助员工不跳转也能预判。
function buildItemsPreview(order: Order) {
  if (!order.order_items?.length) return "";
  const parts = order.order_items
    .slice(0, 3)
    .map((it) => `${it.product?.name ?? "商品"} × ${it.quantity}`);
  const suffix = order.order_items.length > 3 ? " …" : "";
  return parts.join(" · ") + suffix;
}

export function MerchantOrderCard({ order }: { order: Order }) {
  const tone = orderStatusToTone(order.status);
  const label = STATUS_LABEL[order.status] ?? order.status;
  const receiver = [
    order.logistics_receiver_name || "未填写",
    order.logistics_receiver_phone || "",
  ]
    .filter(Boolean)
    .join(" · ");
  const itemsPreview = buildItemsPreview(order);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/merchant/orders/[id]",
          params: { id: order.id },
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
          marginBottom: 8,
          gap: 8,
        }}
      >
        <Text
          style={{
            color: MerchantColors.ink900,
            fontSize: 13,
            fontWeight: "600",
            letterSpacing: 0.4,
          }}
          numberOfLines={1}
        >
          {order.order_no ?? order.id.slice(0, 8)}
        </Text>
        <MerchantStatusBadge tone={tone} label={label} />
        <Text
          style={{
            color: MerchantColors.ink900,
            fontSize: 15,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          ¥{order.total ?? "-"}
        </Text>
      </View>

      <Text style={{ color: MerchantColors.ink500, fontSize: 12 }}>
        下单 {formatDate(order.created_at)}
      </Text>
      <Text
        style={{ color: MerchantColors.ink500, fontSize: 12, marginTop: 2 }}
        numberOfLines={1}
      >
        收件 {receiver || "-"}
      </Text>

      {itemsPreview ? (
        <>
          <View
            style={{
              height: 1,
              backgroundColor: MerchantColors.line,
              marginVertical: 10,
            }}
          />
          <Text
            style={{ color: MerchantColors.ink500, fontSize: 12 }}
            numberOfLines={1}
          >
            {itemsPreview}
          </Text>
        </>
      ) : null}
    </Pressable>
  );
}
