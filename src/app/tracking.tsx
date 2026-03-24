import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";

import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useOrderStore } from "@/stores/orderStore";
import { useUserStore } from "@/stores/userStore";
import type { Order, OrderItem } from "@/types/database";

type TimelineState = "done" | "current" | "pending" | "cancelled";

interface TimelineItem {
  title: string;
  detail: string;
  time: string;
  state: TimelineState;
}

interface StatusMeta {
  title: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  background: string;
}

interface PackageSummary {
  title: string;
  count: number;
  imageUrls: string[];
}

/**
 * 将 ISO 时间统一格式化成页面展示文案。
 * 若后端当前没有更细的物流时间字段，则明确展示“待更新”，避免伪造具体时间。
 */
function formatDateTime(value?: string | null) {
  if (!value) {
    return "待更新";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "待更新";
  }

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** 订单号通常较长，物流页只展示更适合用户识别的后 8 位。 */
function getDisplayOrderCode(orderId: string) {
  return orderId.slice(-8);
}

/**
 * 物流页只需要一个“对用户友好”的手机号展示形式，因此统一在前端脱敏。
 */
function maskPhone(phone?: string | null) {
  if (!phone) {
    return "暂未获取";
  }

  if (phone.length < 7) {
    return phone;
  }

  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

/**
 * 当前项目的配送方式仍是内部值，先在页面层做最小翻译。
 * 后续如果配送方式扩展，只需要维护这个映射表即可。
 */
function getDeliveryLabel(deliveryType?: string | null) {
  switch (deliveryType) {
    case "standard":
      return "标准配送";
    case "express":
      return "极速配送";
    case "pickup":
      return "到店自提";
    default:
      return deliveryType ? `配送方式：${deliveryType}` : "待分配配送方式";
  }
}

/**
 * 物流页的“支付已完成”节点不直接依赖单一字段。
 * 这里做一个轻量聚合判断，兼容历史订单与不同来源的数据写入。
 */
function hasPaymentEvidence(order: Order) {
  return Boolean(
    order.paid_at ||
      order.paid_amount ||
      order.trade_no ||
      order.payment_status === "success" ||
      order.status === "paid" ||
      order.status === "shipping" ||
      order.status === "delivered"
  );
}

/**
 * 顶部状态卡只负责回答“订单当前走到哪一步了”，
 * 文案和视觉色统一从这里派生，避免在 JSX 内散落条件判断。
 */
function getTrackingStatusMeta(status: Order["status"]): StatusMeta {
  switch (status) {
    case "pending":
      return {
        title: "待支付",
        description: "订单已创建，请尽快完成支付后进入发货流程。",
        icon: "payments",
        color: "#d97706",
        background: "#fff7ed",
      };
    case "paid":
      return {
        title: "待发货",
        description: "支付成功，仓库正在准备商品并安排出库。",
        icon: "inventory-2",
        color: Colors.primaryContainer,
        background: "#eef6eb",
      };
    case "shipping":
      return {
        title: "运输中",
        description: "包裹已发出，正在配送途中，请留意后续状态更新。",
        icon: "local-shipping",
        color: "#2563eb",
        background: "#eff6ff",
      };
    case "delivered":
      return {
        title: "已送达",
        description: "包裹已送达，本次订单履约已完成。",
        icon: "task-alt",
        color: "#15803d",
        background: "#f0fdf4",
      };
    case "cancelled":
      return {
        title: "已取消",
        description: "订单已取消，本次履约流程已终止。",
        icon: "cancel",
        color: Colors.error,
        background: "#fef2f2",
      };
  }
}

/**
 * 使用现有订单字段生成“准真实”履约时间线。
 * 这一步的目标不是伪装成第三方物流轨迹，而是把当前订单状态讲清楚。
 */
function buildTrackingTimeline(order: Order): TimelineItem[] {
  const paid = hasPaymentEvidence(order);
  const paidTime = formatDateTime(order.paid_at ?? (paid ? order.updated_at : null));
  const updatedTime = formatDateTime(order.updated_at);

  const items: TimelineItem[] = [
    {
      title: "订单已创建",
      detail: "订单已提交，系统已记录您的商品、地址和配送信息。",
      time: formatDateTime(order.created_at),
      state: "done",
    },
  ];

  if (order.status === "pending") {
    items.push(
      {
        title: "待支付",
        detail: "订单已创建，请完成支付后进入发货流程。",
        time: "待更新",
        state: "current",
      },
      {
        title: "待发货",
        detail: "支付成功后，仓库会尽快配货并安排出库。",
        time: "待更新",
        state: "pending",
      },
      {
        title: "运输中",
        detail: "商家发货后，订单履约进度会在这里继续更新。",
        time: "待更新",
        state: "pending",
      },
      {
        title: "已送达",
        detail: "订单完成配送后，系统会在这里标记已送达。",
        time: "待更新",
        state: "pending",
      }
    );

    return items;
  }

  items.push({
    title: "支付已完成",
    detail: "订单已完成支付，系统已将其加入仓库处理队列。",
    time: paidTime,
    state: "done",
  });

  if (order.status === "paid") {
    items.push(
      {
        title: "待发货",
        detail: "仓库正在配货打包，准备发货。",
        time: updatedTime,
        state: "current",
      },
      {
        title: "运输中",
        detail: "商家发货后，运输节点会在这里继续更新。",
        time: "待更新",
        state: "pending",
      },
      {
        title: "已送达",
        detail: "订单完成配送后，系统会在这里标记已送达。",
        time: "待更新",
        state: "pending",
      }
    );

    return items;
  }

  if (order.status === "shipping") {
    items.push(
      {
        title: "待发货",
        detail: "仓库已完成配货并安排出库。",
        time: updatedTime,
        state: "done",
      },
      {
        title: "运输中",
        detail: "包裹已发出，正在运输途中。",
        time: updatedTime,
        state: "current",
      },
      {
        title: "已送达",
        detail: "订单完成配送后，系统会在这里标记已送达。",
        time: "待更新",
        state: "pending",
      }
    );

    return items;
  }

  if (order.status === "delivered") {
    items.push(
      {
        title: "待发货",
        detail: "仓库已完成配货并安排出库。",
        time: paidTime,
        state: "done",
      },
      {
        title: "运输中",
        detail: "包裹已完成在途运输。",
        time: updatedTime,
        state: "done",
      },
      {
        title: "已送达",
        detail: "包裹已送达，请及时查收并确认商品状态。",
        time: updatedTime,
        state: "done",
      }
    );

    return items;
  }

  if (order.status === "cancelled") {
    items.push({
      title: "订单已取消",
      detail: paid
        ? "订单已终止，本次履约流程不会继续推进。"
        : "订单在支付前已取消，本次履约流程不会继续推进。",
      time: updatedTime,
      state: "cancelled",
    });
  }

  return items;
}

/**
 * 包裹摘要只展示最关键的信息：商品名、件数和已有图片。
 * 没有图片时使用占位，不再回退到固定网络图。
 */
function summarizeOrderItems(items?: OrderItem[]): PackageSummary {
  const safeItems = items ?? [];
  const names = safeItems.map((item) => item.product?.name ?? "商品");
  const count = safeItems.reduce((sum, item) => sum + item.quantity, 0);
  const imageUrls = safeItems
    .map((item) => item.product?.image_url)
    .filter((value): value is string => Boolean(value))
    .slice(0, 2);

  if (names.length === 0) {
    return {
      title: "暂无商品信息",
      count: 0,
      imageUrls,
    };
  }

  if (names.length === 1) {
    return {
      title: names[0],
      count,
      imageUrls,
    };
  }

  if (names.length === 2) {
    return {
      title: `${names[0]}、${names[1]}`,
      count,
      imageUrls,
    };
  }

  return {
    title: `${names[0]}、${names[1]}等${count}件商品`,
    count,
    imageUrls,
  };
}

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
  const { currentOrder, currentOrderLoading, fetchOrderById, updateOrder } = useOrderStore();

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
            onPress={() => router.replace("/orders" as any)}
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
        {/* 顶部状态卡：先回答“当前走到哪一步”，再补充订单基础信息。 */}
        <View className="rounded-2xl p-5 gap-4" style={{ backgroundColor: statusMeta.background }}>
          <View className="flex-row items-start gap-4">
            <View
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{ backgroundColor: `${statusMeta.color}20` }}
            >
              <MaterialIcons name={statusMeta.icon} size={28} color={statusMeta.color} />
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-on-surface text-2xl font-bold">{statusMeta.title}</Text>
              <Text className="text-on-surface-variant text-sm leading-6">{statusMeta.description}</Text>
            </View>
          </View>

          <View className="rounded-xl bg-background/80 p-4 gap-3">
            <TrackingInfoRow label="订单号" value={getDisplayOrderCode(currentOrder.id)} />
            <TrackingInfoRow label="下单时间" value={formatDateTime(currentOrder.created_at)} />
            <TrackingInfoRow label="配送方式" value={getDeliveryLabel(currentOrder.delivery_type)} />
          </View>
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
