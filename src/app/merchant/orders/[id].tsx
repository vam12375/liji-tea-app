import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MerchantBentoBlock } from "@/components/merchant/MerchantBentoBlock";
import { MerchantStatusBadge } from "@/components/merchant/MerchantStatusBadge";
import { MerchantStickyActions } from "@/components/merchant/MerchantStickyActions";
import {
  MerchantTimeline,
  type TimelineStep,
} from "@/components/merchant/MerchantTimeline";
import { ShipOrderDialog } from "@/components/merchant/ShipOrderDialog";
import { AppHeader } from "@/components/ui/AppHeader";
import { MerchantColors } from "@/constants/MerchantColors";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { orderStatusToTone } from "@/lib/merchantFilters";
import { pushMerchantToast } from "@/stores/merchantToastStore";
import { showConfirm } from "@/stores/modalStore";
import { useMerchantStore } from "@/stores/merchantStore";

// 订单详情（v4.4.0 Bento 重排）：
// 身份段 + 收件 / 物流 / 商品 / 时间线 四块 Bento + 底部 sticky 操作条。
// 时间线 4 节点直接派生自 orders.created_at/paid_at/shipped_at/delivered_at。
const STATUS_LABEL: Record<string, string> = {
  pending: "待支付",
  paid: "待发货",
  shipping: "已发货",
  delivered: "已完成",
  cancelled: "已取消",
};

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
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

export default function MerchantOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orders = useMerchantStore((s) => s.orders);
  const shipOrder = useMerchantStore((s) => s.shipOrder);
  const closeOrder = useMerchantStore((s) => s.closeOrder);

  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id]);
  const [showShip, setShowShip] = useState(false);

  if (!order) {
    return (
      <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
        <AppHeader title="订单详情" showBackButton />
        <View className="flex-1 items-center justify-center">
          <Text style={{ color: MerchantColors.ink500 }}>订单不存在或未加载</Text>
        </View>
      </View>
    );
  }

  const tone = orderStatusToTone(order.status);
  const label = STATUS_LABEL[order.status] ?? order.status;
  const canShip = order.status === "paid";
  const canClose = !["delivered", "cancelled"].includes(order.status);
  const hasAction = canShip || canClose;

  // 时间线：已完成走实心茶青点；未到节点时间置空显示 "--"。
  const timelineSteps: TimelineStep[] = [
    {
      time: formatDateTime(order.created_at),
      label: "下单",
      done: true,
    },
    {
      time: formatDateTime(order.paid_at),
      label: "已支付",
      done: !!order.paid_at,
    },
    {
      time: formatDateTime(order.shipped_at),
      label: "已发货",
      done: !!order.shipped_at,
    },
    {
      time: formatDateTime(order.delivered_at),
      label: "已签收",
      done: !!order.delivered_at,
    },
  ];

  const handleShip = async (carrier: string, no: string) => {
    try {
      await shipOrder(order.id, carrier, no);
      pushMerchantToast({
        kind: "success",
        title: "发货成功",
        detail: order.order_no ?? order.id.slice(0, 8),
      });
    } catch (err) {
      pushMerchantToast({
        kind: "error",
        title: "发货失败",
        detail: classifyMerchantError(err).message,
      });
      throw err;
    }
  };

  const handleClose = () => {
    showConfirm(
      "确认关闭订单？",
      "关闭后不可恢复；如需退款请让顾客走售后流程。",
      async () => {
        try {
          await closeOrder(order.id, "商家关闭");
          router.back();
        } catch (err) {
          pushMerchantToast({
            kind: "error",
            title: "操作失败",
            detail: classifyMerchantError(err).message,
          });
        }
      },
      { confirmStyle: "destructive" },
    );
  };

  const itemsCount =
    order.order_items?.reduce((sum, it) => sum + (it.quantity ?? 0), 0) ?? 0;

  return (
    <View className="flex-1" style={{ backgroundColor: MerchantColors.paper }}>
      <AppHeader title="订单详情" showBackButton />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 12,
          // 预留 sticky 操作条高度（按钮 48 + 上下 padding 24 ≈ 72）+ SafeArea bottom。
          // 无操作态不用预留。
          paddingBottom: hasAction ? 96 : 24,
        }}
      >
        {/* 身份段 */}
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: MerchantColors.ink500,
              fontSize: 11,
              letterSpacing: 0.8,
            }}
          >
            订单号 · {order.order_no ?? order.id.slice(0, 8)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <MerchantStatusBadge tone={tone} label={label} size="md" />
            <Text
              style={{
                color: MerchantColors.ink900,
                fontFamily: "NotoSerifSC_700Bold",
                fontSize: 28,
                lineHeight: 34,
              }}
            >
              {label}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 12,
              marginTop: 2,
            }}
          >
            <Text
              style={{
                color: MerchantColors.ink900,
                fontSize: 20,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              ¥{order.total ?? "-"}
            </Text>
            <Text style={{ color: MerchantColors.ink500, fontSize: 12 }}>
              下单 {formatDateTime(order.created_at) ?? "-"}
            </Text>
          </View>
        </View>

        {/* Bento：收件 */}
        <MerchantBentoBlock title="收件">
          <Text style={{ color: MerchantColors.ink900, fontSize: 14 }}>
            {order.logistics_receiver_name ?? "-"}
            {order.logistics_receiver_phone
              ? ` · ${order.logistics_receiver_phone}`
              : ""}
          </Text>
          <Text
            style={{ color: MerchantColors.ink500, fontSize: 12, lineHeight: 18 }}
          >
            {order.logistics_address ?? "-"}
          </Text>
        </MerchantBentoBlock>

        {/* Bento：物流（仅在有物流数据时展示） */}
        {order.logistics_company || order.logistics_tracking_no ? (
          <MerchantBentoBlock title="物流">
            <View style={{ gap: 4 }}>
              <Text style={{ color: MerchantColors.ink900, fontSize: 14 }}>
                {order.logistics_company ?? "-"}
              </Text>
              <Text
                style={{
                  color: MerchantColors.ink500,
                  fontSize: 12,
                  fontVariant: ["tabular-nums"],
                }}
              >
                运单 {order.logistics_tracking_no ?? "-"}
              </Text>
            </View>
          </MerchantBentoBlock>
        ) : null}

        {/* Bento：商品 */}
        {order.order_items?.length ? (
          <MerchantBentoBlock
            title="商品"
            summary={`${order.order_items.length} 项 · ${itemsCount} 件`}
          >
            {order.order_items.map((item) => (
              <View
                key={item.id}
                style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}
              >
                <Text
                  style={{ color: MerchantColors.ink900, fontSize: 13, flex: 1 }}
                  numberOfLines={1}
                >
                  {item.product?.name ?? item.product_id} × {item.quantity}
                </Text>
                <Text
                  style={{
                    color: MerchantColors.ink500,
                    fontSize: 13,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  ¥{item.unit_price}
                </Text>
              </View>
            ))}
          </MerchantBentoBlock>
        ) : null}

        {/* Bento：时间线 */}
        <MerchantBentoBlock title="时间线">
          <MerchantTimeline steps={timelineSteps} />
        </MerchantBentoBlock>
      </ScrollView>

      {hasAction ? (
        <MerchantStickyActions>
          {canClose ? (
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                {
                  flex: 1,
                  borderWidth: 1,
                  borderColor: MerchantColors.line,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  backgroundColor: "transparent",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: MerchantColors.ink900, fontWeight: "600" }}>
                关闭订单
              </Text>
            </Pressable>
          ) : null}
          {canShip ? (
            <Pressable
              onPress={() => setShowShip(true)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  backgroundColor: MerchantColors.statusGo,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>发货</Text>
            </Pressable>
          ) : null}
        </MerchantStickyActions>
      ) : null}

      <ShipOrderDialog
        visible={showShip}
        onClose={() => setShowShip(false)}
        onSubmit={handleShip}
      />
    </View>
  );
}
