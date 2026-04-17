import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { ShipOrderDialog } from "@/components/merchant/ShipOrderDialog";
import { AppHeader } from "@/components/ui/AppHeader";
import { classifyMerchantError } from "@/lib/merchantErrors";
import { showConfirm } from "@/stores/modalStore";
import { useMerchantStore } from "@/stores/merchantStore";

// 订单详情页：只读展示 + 底部操作条。
// - paid 态才展示「发货」按钮；delivered/cancelled 不可关闭。
// - 发货走 ShipOrderDialog；关闭走 showConfirm。
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
      <View className="flex-1 bg-surface">
        <AppHeader title="订单详情" showBackButton />
        <View className="flex-1 items-center justify-center">
          <Text className="text-on-surface-variant">订单不存在或未加载</Text>
        </View>
      </View>
    );
  }

  const canShip = order.status === "paid";
  const canClose = !["delivered", "cancelled"].includes(order.status);

  const handleShip = async (carrier: string, no: string) => {
    try {
      await shipOrder(order.id, carrier, no);
      Alert.alert("发货成功");
    } catch (err) {
      Alert.alert("发货失败", classifyMerchantError(err).message);
      throw err; // 让弹窗保持非 loading，不清空用户已输入的数据
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
          Alert.alert("操作失败", classifyMerchantError(err).message);
        }
      },
      { confirmStyle: "destructive" },
    );
  };

  return (
    <View className="flex-1 bg-surface">
      <AppHeader title="订单详情" showBackButton />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-on-surface text-base font-semibold">
          订单号：{order.order_no ?? order.id}
        </Text>
        <Text className="text-on-surface-variant text-sm">状态：{order.status}</Text>
        <Text className="text-on-surface-variant text-sm">
          下单时间：{new Date(order.created_at).toLocaleString("zh-CN")}
        </Text>
        <Text className="text-on-surface text-sm">金额：¥{order.total}</Text>

        <View className="mt-2 p-3 rounded-xl bg-surface-bright gap-1">
          <Text className="text-on-surface font-medium">收件信息</Text>
          <Text className="text-on-surface-variant text-xs">
            {order.logistics_receiver_name ?? "-"} · {order.logistics_receiver_phone ?? "-"}
          </Text>
          <Text className="text-on-surface-variant text-xs">
            {order.logistics_address ?? "-"}
          </Text>
        </View>

        {order.logistics_company || order.logistics_tracking_no ? (
          <View className="p-3 rounded-xl bg-surface-bright gap-1">
            <Text className="text-on-surface font-medium">物流</Text>
            <Text className="text-on-surface-variant text-xs">
              承运商：{order.logistics_company ?? "-"}
            </Text>
            <Text className="text-on-surface-variant text-xs">
              运单号：{order.logistics_tracking_no ?? "-"}
            </Text>
          </View>
        ) : null}

        {order.order_items?.length ? (
          <View className="p-3 rounded-xl bg-surface-bright gap-2">
            <Text className="text-on-surface font-medium">商品</Text>
            {order.order_items.map((item) => (
              <View key={item.id} className="flex-row justify-between">
                <Text className="text-on-surface-variant text-xs" numberOfLines={1}>
                  {item.product?.name ?? item.product_id} × {item.quantity}
                </Text>
                <Text className="text-on-surface-variant text-xs">
                  ¥{item.unit_price}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View className="flex-row gap-3 mt-4">
          {canShip ? (
            <Pressable
              onPress={() => setShowShip(true)}
              className="flex-1 bg-primary rounded-lg py-3 items-center"
            >
              <Text className="text-on-primary font-medium">发货</Text>
            </Pressable>
          ) : null}
          {canClose ? (
            <Pressable
              onPress={handleClose}
              className="flex-1 border border-outline rounded-lg py-3 items-center"
            >
              <Text className="text-on-surface">关闭订单</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <ShipOrderDialog
        visible={showShip}
        onClose={() => setShowShip(false)}
        onSubmit={handleShip}
      />
    </View>
  );
}
