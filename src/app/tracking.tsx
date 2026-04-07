import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";

import { Colors } from "@/constants/Colors";
import { updateMockLogistics } from "@/lib/payment";
import { supabase } from "@/lib/supabase";
import {
  buildTrackingTimeline,
  formatDateTime,
  formatRemainingPaymentTime,
  getDeliveryLabel,
  getDisplayOrderCode,
  getLogisticsStatusLabel,
  getPendingPaymentDeadline,
  getTrackingStatusMeta,
  mapTrackingEvents,
  maskPhone,
  summarizeOrderItems,
} from "@/lib/trackingUtils";
import type { TrackingEventRow, TimelineState } from "@/lib/trackingUtils";
import { showModal, showConfirm } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import { useUserStore } from "@/stores/userStore";
import type { Order } from "@/types/database";
import type { MockLogisticsAction, TrackingEvent } from "@/types/payment";

function renderTimelineMarker(state: TimelineState) {
  if (state === "done") {
    return (
      <View className="w-6 h-6 rounded-full items-center justify-center z-10" style={{ backgroundColor: Colors.primaryContainer }}>
        <MaterialIcons name="check" size={14} color="#fff" />
      </View>
    );
  }

  if (state === "current") {
    return (
      <View
        className="w-6 h-6 rounded-full items-center justify-center z-10 border-2"
        style={{ borderColor: Colors.primaryContainer, backgroundColor: Colors.background }}
      >
        <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: Colors.primaryContainer }} />
      </View>
    );
  }

  if (state === "cancelled") {
    return (
      <View className="w-6 h-6 rounded-full items-center justify-center z-10" style={{ backgroundColor: Colors.error }}>
        <MaterialIcons name="close" size={14} color="#fff" />
      </View>
    );
  }

  return <View className="w-3 h-3 rounded-full bg-outline-variant z-10" />;
}

function TrackingInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-outline text-xs">{label}</Text>
      <Text className="text-on-surface text-sm font-medium flex-1 text-right">{value}</Text>
    </View>
  );
}

export default function TrackingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const userId = useUserStore((state) => state.session?.user?.id);
  const { currentOrder, currentOrderLoading, fetchOrderById, updateOrder, cancelOrder, confirmReceive } = useOrderStore();
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [actionLoading, setActionLoading] = useState<MockLogisticsAction | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!orderId) {
      return;
    }

    void fetchOrderById(orderId);
  }, [fetchOrderById, orderId]);

  /**
   * 保留现有实时订阅能力。
   * 这里不做额外接口轮询，只在订单主表更新时同步刷新当前页面的关键状态字段。
   */
  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel("user-orders")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        (payload) => {
          updateOrder(payload.new as Partial<Order> & { id: string });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateOrder, userId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderId || !userId) {
      setTrackingEvents([]);
      return;
    }

    let active = true;

    const loadTrackingEvents = async () => {
      const { data, error } = await supabase
        .from("order_tracking_events")
        .select("status, title, detail, event_time, sort_order")
        .eq("order_id", orderId)
        .order("sort_order", { ascending: false })
        .order("event_time", { ascending: false })
        .returns<TrackingEventRow[]>();

      if (error) {
        console.warn("[tracking] fetch order_tracking_events 失败:", error);
        if (active) {
          setTrackingEvents([]);
        }
        return;
      }

      if (active) {
        setTrackingEvents(mapTrackingEvents(data));
      }
    };

    void loadTrackingEvents();

    return () => {
      active = false;
    };
  }, [orderId, userId, currentOrder?.updated_at]);

  const handleAdvanceLogistics = async () => {
    if (!orderId || !currentOrder) {
      return;
    }

    const action: MockLogisticsAction = "advance";

    try {
      setActionLoading(action);
      const result = await updateMockLogistics(orderId, action);

      updateOrder({
        id: orderId,
        status: result.status as Order["status"],
        logistics_status: result.logisticsStatus,
        shipped_at: result.shippedAt,
        delivered_at: result.deliveredAt,
        updated_at: new Date().toISOString(),
      });
      setTrackingEvents(result.trackingEvents);
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新模拟物流失败。";
      showModal("物流更新失败", message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const statusMeta = useMemo(
    () => (currentOrder ? getTrackingStatusMeta(currentOrder.status) : null),
    [currentOrder]
  );
  const timeline = useMemo(
    () => (currentOrder ? buildTrackingTimeline(currentOrder) : []),
    [currentOrder]
  );
  const packageSummary = useMemo(
    () => summarizeOrderItems(currentOrder?.order_items),
    [currentOrder?.order_items]
  );
  // 仅开发模式下可用的物流模拟按钮
  const canAdvanceLogistics = __DEV__ && currentOrder?.status === "paid";
  const logisticsActionLabel = "模拟发货";
  // 确认收货按钮：运输中状态可用
  const canConfirmReceive = currentOrder?.status === "shipping";
  // 取消订单按钮
  const canCancelOrder = currentOrder?.status === "pending";
  const paymentDeadline = currentOrder ? getPendingPaymentDeadline(currentOrder.created_at) : null;
  const remainingPaymentMs = paymentDeadline === null ? null : paymentDeadline - now;
  const canRepay = currentOrder?.status === "pending" && remainingPaymentMs !== null && remainingPaymentMs > 0;
  const remainingPaymentText = canRepay && remainingPaymentMs !== null
    ? formatRemainingPaymentTime(remainingPaymentMs)
    : null;

  if (currentOrderLoading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "物流追踪",
            headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
            headerStyle: { backgroundColor: Colors.background },
            headerShadowVisible: false,
            headerLeft: () => (
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
              </Pressable>
            ),
          }}
        />

        <View className="flex-1 items-center justify-center gap-3 px-8">
          <ActivityIndicator size="large" color={Colors.primaryContainer} />
          <Text className="text-on-surface text-sm font-medium">正在加载订单履约信息</Text>
          <Text className="text-outline text-xs text-center leading-5">
            页面会根据当前订单状态生成真实的履约阶段展示。
          </Text>
        </View>
      </View>
    );
  }

  if (!orderId || !currentOrder || !statusMeta) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "物流追踪",
            headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
            headerStyle: { backgroundColor: Colors.background },
            headerShadowVisible: false,
            headerLeft: () => (
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
              </Pressable>
            ),
          }}
        />

        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="w-16 h-16 rounded-full bg-surface-container-low items-center justify-center">
            <MaterialIcons name="inventory" size={30} color={Colors.outline} />
          </View>
          <View className="items-center gap-2">
            <Text className="text-on-surface text-base font-bold">未找到订单信息</Text>
            <Text className="text-outline text-sm text-center leading-6">
              当前订单不存在、已失效，或您暂时无权查看这条订单履约信息。
            </Text>
          </View>
          <Pressable
            onPress={() => router.replace("/orders")}
            className="bg-primary-container rounded-full px-5 py-3 active:bg-primary"
          >
            <Text className="text-on-primary font-medium">返回订单列表</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "物流追踪",
          headerTitleStyle: { fontFamily: "Manrope_500Medium", fontSize: 16 },
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-8 gap-4" showsVerticalScrollIndicator={false}>
        {/* 顶部状态卡：先回答"当前走到哪一步"，再补充订单基础信息。 */}
        <View className="rounded-2xl p-5 gap-4" style={{ backgroundColor: statusMeta.background }}>
          <View className="flex-row items-start gap-4">
            <View
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{ backgroundColor: `${statusMeta.color}20` }}
            >
              <MaterialIcons name={statusMeta.icon as keyof typeof MaterialIcons.glyphMap} size={28} color={statusMeta.color} />
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-on-surface text-2xl font-bold">{statusMeta.title}</Text>
              <Text className="text-on-surface-variant text-sm leading-6">{statusMeta.description}</Text>
            </View>
          </View>

          <View className="rounded-xl bg-background/80 p-4 gap-3">
            <TrackingInfoRow label="订单号" value={getDisplayOrderCode(currentOrder.id, currentOrder.order_no)} />
            <TrackingInfoRow label="下单时间" value={formatDateTime(currentOrder.created_at)} />
            <TrackingInfoRow label="配送方式" value={getDeliveryLabel(currentOrder.delivery_type)} />
            {typeof currentOrder.coupon_discount === "number" && currentOrder.coupon_discount > 0 ? (
              <>
                <TrackingInfoRow
                  label="优惠券"
                  value={
                    currentOrder.coupon_title
                      ? `${currentOrder.coupon_title}${currentOrder.coupon_code ? `（${currentOrder.coupon_code}）` : ""}`
                      : currentOrder.coupon_code ?? "已使用优惠券"
                  }
                />
                <TrackingInfoRow
                  label="优惠抵扣"
                  value={`-¥${currentOrder.coupon_discount.toFixed(2)}`}
                />
              </>
            ) : null}
          </View>

          {currentOrder.status === "pending" ? (
            <View className="rounded-xl bg-background/80 p-4 gap-3">
              <View className="gap-1">
                <Text className="text-on-surface text-sm font-medium">
                  {canRepay && remainingPaymentText
                    ? `请在 ${remainingPaymentText} 内完成支付`
                    : "订单支付已超时，系统正在自动取消"}
                </Text>
                <Text className="text-outline text-xs leading-5">
                  待付款订单会在下单 10 分钟后自动关闭，超时后将无法继续支付。
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/payment",
                    params: {
                      orderId: currentOrder.id,
                      total: String(currentOrder.total),
                      paymentMethod: currentOrder.payment_method ?? "alipay",
                    },
                  })
                }
                disabled={!canRepay}
                className={`rounded-full py-3 items-center justify-center ${canRepay ? "bg-primary-container active:bg-primary" : "bg-surface"}`}
              >
                <Text className={`font-medium ${canRepay ? "text-on-primary" : "text-outline"}`}>
                  立即付款
                </Text>
              </Pressable>

              {/* 取消订单 */}
              <Pressable
                onPress={() => {
                  showConfirm("取消订单", "确定要取消该订单吗？库存将被释放。", async () => {
                    const err = await cancelOrder(currentOrder.id);
                    if (err) showModal("取消失败", err, "error");
                  }, { icon: "delete", confirmText: "确认取消", confirmStyle: "destructive" });
                }}
                className="rounded-full py-3 items-center justify-center border border-outline-variant active:opacity-70"
              >
                <Text className="text-outline font-medium">取消订单</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* 收货信息：明确告诉用户订单最终会送到哪里，替代原来的假地图和假起终点。 */}
        <View className="bg-surface-container-low rounded-2xl p-4 gap-3">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="location-on" size={18} color={Colors.primaryContainer} />
            <Text className="text-on-surface text-base font-bold">收货信息</Text>
          </View>

          {currentOrder.address ? (
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-on-surface text-sm font-medium">{currentOrder.address.name}</Text>
                <Text className="text-outline text-xs">{maskPhone(currentOrder.address.phone)}</Text>
              </View>
              <Text className="text-on-surface-variant text-sm leading-6">{currentOrder.address.address}</Text>
            </View>
          ) : (
            <Text className="text-outline text-sm">暂未获取收货地址</Text>
          )}
        </View>

        <View className="bg-surface-container-low rounded-2xl p-4 gap-4">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="local-shipping" size={18} color={Colors.primaryContainer} />
            <Text className="text-on-surface text-base font-bold">物流信息</Text>
          </View>

          <View className="rounded-xl bg-background px-3 py-3 gap-3">
            <TrackingInfoRow label="物流公司" value={currentOrder.logistics_company ?? "模拟快递"} />
            <TrackingInfoRow label="运单号" value={currentOrder.logistics_tracking_no ?? "待生成"} />
            <TrackingInfoRow label="物流状态" value={getLogisticsStatusLabel(currentOrder.logistics_status)} />
            <TrackingInfoRow label="发货时间" value={formatDateTime(currentOrder.shipped_at)} />
            <TrackingInfoRow label="签收时间" value={formatDateTime(currentOrder.delivered_at)} />
          </View>

          {canAdvanceLogistics ? (
            <Pressable
              onPress={handleAdvanceLogistics}
              disabled={actionLoading !== null}
              className="rounded-full bg-primary-container py-3 items-center justify-center active:bg-primary"
            >
              <Text className="text-on-primary font-medium">
                {actionLoading ? "正在推进物流..." : logisticsActionLabel}
              </Text>
            </Pressable>
          ) : null}

          {/* 确认收货按钮 */}
          {canConfirmReceive ? (
            <Pressable
              onPress={() => {
                showConfirm("确认收货", "确认已收到商品吗？", async () => {
                  const err = await confirmReceive(currentOrder.id);
                  if (err) showModal("确认失败", err, "error");
                  else showModal("已确认", "感谢您的购买！", "success");
                }, { confirmText: "确认收货" });
              }}
              className="rounded-full bg-primary-container py-3 items-center justify-center active:bg-primary"
            >
              <Text className="text-on-primary font-medium">确认收货</Text>
            </Pressable>
          ) : null}
        </View>

        <View className="bg-surface-container-low rounded-2xl p-4 gap-4">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="fact-check" size={18} color={Colors.primaryContainer} />
            <Text className="text-on-surface text-base font-bold">最新物流轨迹</Text>
          </View>

          {trackingEvents.length > 0 ? (
            <View className="relative">
              <View className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-outline-variant/40" />

              {trackingEvents.map((item, index) => {
                const markerState: TimelineState =
                  item.status === "delivered"
                    ? "done"
                    : index === 0
                      ? "current"
                      : "done";

                return (
                  <View
                    key={`${item.title}-${item.eventTime}-${index}`}
                    className={index === trackingEvents.length - 1 ? "flex-row gap-4" : "flex-row gap-4 pb-6"}
                  >
                    <View className="items-center w-6 pt-1">{renderTimelineMarker(markerState)}</View>
                    <View className="flex-1 gap-1">
                      <Text className="text-on-surface text-sm font-medium">{item.title}</Text>
                      <Text className="text-on-surface-variant text-xs leading-5">{item.detail}</Text>
                      <Text className="text-outline text-[10px] mt-0.5">{formatDateTime(item.eventTime)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="rounded-xl bg-background px-3 py-4 gap-1">
              <Text className="text-on-surface text-sm font-medium">暂无物流轨迹</Text>
              <Text className="text-outline text-xs leading-5">
                支付成功后，系统会初始化物流轨迹；后续可在此页面继续模拟推进发货与签收。
              </Text>
            </View>
          )}
        </View>

        {/* 状态驱动时间线：只展示由订单状态推导出的履约阶段，不再伪造物流节点。 */}
        <View className="bg-surface-container-low rounded-2xl p-4 gap-4">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="route" size={18} color={Colors.primaryContainer} />
            <Text className="text-on-surface text-base font-bold">履约进度</Text>
          </View>

          <View className="relative">
            <View className="absolute left-[11px] top-3 bottom-3 w-[2px] bg-outline-variant/40" />

            {timeline.map((item, index) => {
              const titleColor =
                item.state === "cancelled"
                  ? Colors.error
                  : item.state === "pending"
                    ? Colors.outline
                    : Colors.onSurface;

              return (
                <View
                  key={`${item.title}-${index}`}
                  className={index === timeline.length - 1 ? "flex-row gap-4" : "flex-row gap-4 pb-6"}
                >
                  <View className="items-center w-6 pt-1">{renderTimelineMarker(item.state)}</View>
                  <View className="flex-1 gap-1">
                    <Text className="text-sm font-medium" style={{ color: titleColor }}>
                      {item.title}
                    </Text>
                    <Text className="text-on-surface-variant text-xs leading-5">{item.detail}</Text>
                    <Text className="text-outline text-[10px] mt-0.5">{item.time}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* 包裹摘要：使用真实商品信息和已有图片，缺图时明确占位。 */}
        <View className="bg-surface-container-low rounded-2xl p-4 gap-4">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="inventory-2" size={18} color={Colors.primaryContainer} />
            <Text className="text-on-surface text-base font-bold">包裹摘要</Text>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="flex-row -space-x-3">
              {packageSummary.imageUrls.length > 0 ? (
                packageSummary.imageUrls.map((imageUrl, index) => (
                  <Image
                    key={`${imageUrl}-${index}`}
                    source={{ uri: imageUrl }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 9999,
                      borderWidth: 2,
                      borderColor: Colors.surfaceContainerLow,
                    }}
                    contentFit="cover"
                  />
                ))
              ) : (
                <View
                  className="w-11 h-11 rounded-full items-center justify-center"
                  style={{ backgroundColor: Colors.surface }}
                >
                  <MaterialIcons name="inventory" size={20} color={Colors.outline} />
                </View>
              )}
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-on-surface text-sm font-medium">{packageSummary.title}</Text>
              <Text className="text-outline text-xs">共 {packageSummary.count} 件商品</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <View className="px-3 py-1 rounded-full bg-background">
              <Text className="text-on-surface text-xs">{getDeliveryLabel(currentOrder.delivery_type)}</Text>
            </View>

            {typeof currentOrder.coupon_discount === "number" && currentOrder.coupon_discount > 0 ? (
              <View className="px-3 py-1 rounded-full bg-background">
                <Text className="text-primary text-xs">
                  优惠券已抵扣 ¥{currentOrder.coupon_discount.toFixed(2)}
                </Text>
              </View>
            ) : null}

            {currentOrder.gift_wrap && (
              <View className="px-3 py-1 rounded-full bg-background">
                <Text className="text-on-surface text-xs">已选礼盒包装</Text>
              </View>
            )}
          </View>

          {currentOrder.notes ? (
            <View className="rounded-xl bg-background px-3 py-3 gap-1">
              <Text className="text-outline text-xs">订单备注</Text>
              <Text className="text-on-surface text-sm leading-6">{currentOrder.notes}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
