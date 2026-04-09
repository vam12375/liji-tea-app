import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import PaymentCountdown from "@/components/order/PaymentCountdown";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { Colors } from "@/constants/Colors";
import { screenStateCopy, trackingCopy } from "@/constants/copy";
import { useNow } from "@/hooks/useNow";
import { track } from "@/lib/analytics";
import { captureError, logWarn } from "@/lib/logger";
import {
  formatRemainingPaymentTime,
  getPendingPaymentDeadline,
} from "@/lib/orderTiming";
import { updateMockLogistics } from "@/lib/payment";
import { routes } from "@/lib/routes";
import { supabase } from "@/lib/supabase";
import {
  buildTrackingTimeline,
  formatDateTime,
  getDeliveryLabel,
  getDisplayOrderCode,
  getLogisticsStatusLabel,
  getTrackingStatusMeta,
  mapTrackingEvents,
  maskPhone,
  summarizeOrderItems,
} from "@/lib/trackingUtils";
import type {
  PackageSummary,
  StatusMeta,
  TimelineItem,
  TimelineState,
  TrackingEventRow,
} from "@/lib/trackingUtils";
import { showConfirm, showModal } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import { useUserStore } from "@/stores/userStore";
import type { Order } from "@/types/database";
import type {
  MockLogisticsAction,
  PaymentChannel,
  TrackingEvent,
} from "@/types/payment";

/** 物流信息行的展示参数，统一控制标签和值的排版。 */
interface TrackingInfoRowProps {
  label: string;
  value: string;
}

/** 顶部状态卡的入参，聚合订单核心信息和待支付动作。 */
interface TrackingHeaderCardProps {
  order: Order;
  statusMeta: StatusMeta;
  canRepay: boolean;
  remainingPaymentText: string | null;
  onPay: () => void;
  onCancel: () => void;
}

/** 收货信息卡片只依赖当前订单，避免页面内散落地址判断逻辑。 */
interface TrackingAddressCardProps {
  order: Order;
}

/** 物流动作卡同时承载物流信息、模拟发货和确认收货按钮。 */
interface TrackingActionsCardProps {
  order: Order;
  canAdvanceLogistics: boolean;
  canConfirmReceive: boolean;
  actionLoading: MockLogisticsAction | null;
  onAdvanceLogistics: () => void;
  onConfirmReceive: () => void;
}

/** 最新物流轨迹卡的输入参数。 */
interface TrackingLatestEventsCardProps {
  trackingEvents: TrackingEvent[];
  eventsLoading: boolean;
}

/** 包裹摘要卡的输入参数。 */
interface TrackingPackageCardProps {
  order: Order;
  packageSummary: PackageSummary;
}

/** 履约进度卡的输入参数。 */
interface TrackingTimelineCardProps {
  timeline: TimelineItem[];
}

/** Realtime 订阅收到的 payload 只需要最小校验 id 字段即可落到 store。 */
function isOrderUpdatePayload(value: unknown): value is Partial<Order> & { id: string } {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

/**
 * 支付页路由目前只接受项目内定义的支付渠道值。
 * 这里兼容历史字段 payment_method / payment_channel，并在缺失时回落到支付宝。
 */
function normalizePaymentChannel(
  paymentChannel?: string | null,
  paymentMethod?: string | null,
): PaymentChannel {
  const candidates = [paymentChannel, paymentMethod];

  for (const candidate of candidates) {
    if (candidate === "alipay" || candidate === "wechat" || candidate === "card") {
      return candidate;
    }
  }

  return "alipay";
}

/**
 * 将订单 Realtime 订阅逻辑抽成独立 hook，避免页面主体里混杂订阅细节。
 * 同时把 channel 命名收敛为“用户 + 订单”级别，降低后续冲突概率。
 */
function useTrackingSubscription(orderId?: string, userId?: string) {
  const updateOrder = useOrderStore((state) => state.updateOrder);

  useEffect(() => {
    if (!orderId || !userId) {
      return;
    }

    const channelName = `order-tracking:${userId}:${orderId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // 这里只接受最小合法的订单更新结构，避免异常 payload 直接污染 store。
          if (!isOrderUpdatePayload(payload.new)) {
            logWarn("tracking", "收到非法订单更新 payload", {
              orderId,
              userId,
              payload: payload.new,
            });
            return;
          }

          updateOrder(payload.new);
        },
      )
      .subscribe((status) => {
        // 订阅异常统一接入埋点，后续可接真实监控平台统计频道稳定性。
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          track("tracking_subscription_error", {
            orderId,
            userId,
            channelName,
            status,
          });
          logWarn("tracking", "订单追踪订阅状态异常", {
            orderId,
            userId,
            channelName,
            status,
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, updateOrder, userId]);
}

/**
 * 将物流事件查询抽成独立 hook，让页面主体只消费“事件列表 + 加载状态”。
 * 同时把错误埋点和日志都统一收口在这里。
 */
function useTrackingEvents(
  orderId?: string,
  userId?: string,
  updatedAt?: string | null,
) {
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!orderId || !userId) {
      setTrackingEvents([]);
      setEventsLoading(false);
      return;
    }

    let active = true;

    const loadTrackingEvents = async () => {
      try {
        setEventsLoading(true);

        const { data, error } = await supabase
          .from("order_tracking_events")
          .select("status, title, detail, event_time, sort_order")
          .eq("order_id", orderId)
          .order("sort_order", { ascending: false })
          .order("event_time", { ascending: false })
          .returns<TrackingEventRow[]>();

        if (error) {
          throw error;
        }

        if (active) {
          setTrackingEvents(mapTrackingEvents(data));
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "物流轨迹加载失败";

        track("tracking_events_fetch_failed", {
          orderId,
          userId,
          message,
        });
        captureError(error, {
          scope: "tracking",
          message: "loadTrackingEvents 失败",
          orderId,
          userId,
        });

        if (active) {
          setTrackingEvents([]);
        }
      } finally {
        if (active) {
          setEventsLoading(false);
        }
      }
    };

    void loadTrackingEvents();

    return () => {
      active = false;
    };
  }, [orderId, updatedAt, userId]);

  /** 允许页面在模拟物流成功后直接回填最新轨迹，减少一次无意义等待。 */
  const replaceTrackingEvents = useCallback((events: TrackingEvent[]) => {
    setTrackingEvents(events);
    setEventsLoading(false);
  }, []);

  return {
    trackingEvents,
    eventsLoading,
    replaceTrackingEvents,
  };
}

/** 统一渲染时间线节点，保证物流轨迹与履约进度视觉风格一致。 */
function TrackingTimelineMarker({ state }: { state: TimelineState }) {
  if (state === "done") {
    return (
      <View
        className="h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: Colors.primaryContainer }}
      >
        <MaterialIcons name="check" size={14} color="#fff" />
      </View>
    );
  }

  if (state === "current") {
    return (
      <View
        className="h-6 w-6 items-center justify-center rounded-full border-2"
        style={{ borderColor: Colors.primaryContainer, backgroundColor: Colors.background }}
      >
        <View
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: Colors.primaryContainer }}
        />
      </View>
    );
  }

  if (state === "cancelled") {
    return (
      <View
        className="h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: Colors.error }}
      >
        <MaterialIcons name="close" size={14} color="#fff" />
      </View>
    );
  }

  return (
    <View
      className="h-3 w-3 rounded-full"
      style={{ backgroundColor: Colors.outlineVariant }}
    />
  );
}

/** 统一两列表单项布局，减少各卡片重复写相同行样式。 */
function TrackingInfoRow({ label, value }: TrackingInfoRowProps) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-outline text-xs">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-on-surface">{value}</Text>
    </View>
  );
}

/** 顶部卡片只处理订单状态总览、订单信息和待支付操作。 */
function TrackingHeaderCard({
  order,
  statusMeta,
  canRepay,
  remainingPaymentText,
  onPay,
  onCancel,
}: TrackingHeaderCardProps) {
  return (
    <View className="gap-4 rounded-2xl p-5" style={{ backgroundColor: statusMeta.background }}>
      <View className="flex-row items-start gap-4">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${statusMeta.color}20` }}
        >
          <MaterialIcons
            name={statusMeta.icon as keyof typeof MaterialIcons.glyphMap}
            size={28}
            color={statusMeta.color}
          />
        </View>

        <View className="flex-1 gap-1">
          <Text className="text-2xl font-bold text-on-surface">{statusMeta.title}</Text>
          <Text className="text-sm leading-6 text-on-surface-variant">{statusMeta.description}</Text>
        </View>
      </View>

      <View className="gap-3 rounded-xl bg-background/80 p-4">
        <TrackingInfoRow
          label={trackingCopy.labels.orderNumber}
          value={getDisplayOrderCode(order.id, order.order_no)}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.orderedAt}
          value={formatDateTime(order.created_at)}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.deliveryType}
          value={getDeliveryLabel(order.delivery_type)}
        />

        {typeof order.coupon_discount === "number" && order.coupon_discount > 0 ? (
          <>
            <TrackingInfoRow
              label={trackingCopy.labels.coupon}
              value={
                order.coupon_title
                  ? `${order.coupon_title}${order.coupon_code ? `（${order.coupon_code}）` : ""}`
                  : order.coupon_code ?? trackingCopy.fallback.couponUsed
              }
            />
            <TrackingInfoRow
              label={trackingCopy.labels.couponDiscount}
              value={`-¥${order.coupon_discount.toFixed(2)}`}
            />
          </>
        ) : null}

        {order.notes ? (
          <TrackingInfoRow label={trackingCopy.labels.orderNote} value={order.notes} />
        ) : null}
      </View>

      {order.status === "pending" ? (
        <View className="gap-3 rounded-xl bg-background/80 p-4">
          <PaymentCountdown remainingText={remainingPaymentText} isPayable={canRepay} />

          <Pressable
            onPress={onPay}
            disabled={!canRepay}
            className={`items-center justify-center rounded-full py-3 ${
              canRepay ? "bg-primary-container active:bg-primary" : "bg-surface"
            }`}
          >
            <Text className={`font-medium ${canRepay ? "text-on-primary" : "text-outline"}`}>
              {trackingCopy.actions.payNow}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            className="items-center justify-center rounded-full border border-outline-variant py-3 active:opacity-70"
          >
            <Text className="font-medium text-outline">{trackingCopy.actions.cancel}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** 收货信息卡单独抽离后，页面主体无需再关心地址判空与脱敏细节。 */
function TrackingAddressCard({ order }: TrackingAddressCardProps) {
  return (
    <View className="gap-3 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="location-on" size={18} color={Colors.primaryContainer} />
        <Text className="text-base font-bold text-on-surface">{trackingCopy.sections.address}</Text>
      </View>

      {order.address ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-medium text-on-surface">{order.address.name}</Text>
            <Text className="text-xs text-outline">{maskPhone(order.address.phone)}</Text>
          </View>
          <Text className="text-sm leading-6 text-on-surface-variant">{order.address.address}</Text>
        </View>
      ) : (
        <Text className="text-sm text-outline">{trackingCopy.fallback.noAddress}</Text>
      )}
    </View>
  );
}

/**
 * 物流动作卡把“物流信息展示”和“订单动作按钮”放在同一处。
 * 这样发货、签收相关逻辑不会继续分散在页面根组件内。
 */
function TrackingActionsCard({
  order,
  canAdvanceLogistics,
  canConfirmReceive,
  actionLoading,
  onAdvanceLogistics,
  onConfirmReceive,
}: TrackingActionsCardProps) {
  return (
    <View className="gap-4 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="local-shipping" size={18} color={Colors.primaryContainer} />
        <Text className="text-base font-bold text-on-surface">{trackingCopy.sections.logistics}</Text>
      </View>

      <View className="gap-3 rounded-xl bg-background px-3 py-3">
        <TrackingInfoRow
          label={trackingCopy.labels.logisticsCompany}
          value={order.logistics_company ?? trackingCopy.fallback.mockCompany}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.trackingNumber}
          value={order.logistics_tracking_no ?? trackingCopy.fallback.trackingNumberPending}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.logisticsStatus}
          value={getLogisticsStatusLabel(order.logistics_status)}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.shippedAt}
          value={formatDateTime(order.shipped_at)}
        />
        <TrackingInfoRow
          label={trackingCopy.labels.deliveredAt}
          value={formatDateTime(order.delivered_at)}
        />
      </View>

      {canAdvanceLogistics ? (
        <Pressable
          onPress={onAdvanceLogistics}
          disabled={actionLoading !== null}
          className="items-center justify-center rounded-full bg-primary-container py-3 active:bg-primary"
        >
          <Text className="font-medium text-on-primary">
            {actionLoading
              ? trackingCopy.actions.advancingLogistics
              : trackingCopy.actions.advanceLogistics}
          </Text>
        </Pressable>
      ) : null}

      {canConfirmReceive ? (
        <Pressable
          onPress={onConfirmReceive}
          className="items-center justify-center rounded-full bg-primary-container py-3 active:bg-primary"
        >
          <Text className="font-medium text-on-primary">{trackingCopy.actions.confirmReceive}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 最新物流轨迹卡专注处理 section 内部的加载态、空态和列表渲染。 */
function TrackingLatestEventsCard({
  trackingEvents,
  eventsLoading,
}: TrackingLatestEventsCardProps) {
  return (
    <View className="gap-4 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="fact-check" size={18} color={Colors.primaryContainer} />
        <Text className="text-base font-bold text-on-surface">{trackingCopy.sections.latestEvents}</Text>
      </View>

      {eventsLoading ? (
        <View className="items-center gap-3 rounded-xl bg-background px-4 py-5">
          <ActivityIndicator size="small" color={Colors.primaryContainer} />
          <Text className="text-sm font-medium text-on-surface">
            {trackingCopy.fallback.trackingLoading}
          </Text>
          <Text className="text-center text-xs leading-5 text-outline">
            {trackingCopy.fallback.trackingLoadingDescription}
          </Text>
        </View>
      ) : trackingEvents.length > 0 ? (
        <View className="relative">
          <View
            className="absolute bottom-3 left-[11px] top-3 w-[2px] bg-outline-variant/40"
          />

          {trackingEvents.map((item, index) => {
            // 最新物流轨迹按倒序展示，因此首条视为当前节点，其余默认为已完成节点。
            const markerState: TimelineState =
              item.status === "cancelled"
                ? "cancelled"
                : item.status === "delivered"
                  ? "done"
                  : index === 0
                    ? "current"
                    : "done";

            return (
              <View
                key={`${item.title}-${item.eventTime}-${index}`}
                className={
                  index === trackingEvents.length - 1
                    ? "flex-row gap-4"
                    : "flex-row gap-4 pb-6"
                }
              >
                <View className="w-6 items-center pt-1">
                  <TrackingTimelineMarker state={markerState} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-medium text-on-surface">{item.title}</Text>
                  <Text className="text-xs leading-5 text-on-surface-variant">{item.detail}</Text>
                  <Text className="mt-0.5 text-[10px] text-outline">
                    {formatDateTime(item.eventTime)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View className="items-center gap-2 rounded-xl bg-background px-4 py-5">
          <MaterialIcons name="local-shipping" size={22} color={Colors.outline} />
          <Text className="text-sm font-medium text-on-surface">
            {trackingCopy.fallback.trackingEmpty}
          </Text>
          <Text className="text-center text-xs leading-5 text-outline">
            {trackingCopy.fallback.trackingEmptyDescription}
          </Text>
        </View>
      )}
    </View>
  );
}

/** 包裹摘要卡只关心商品缩略图、件数与礼盒包装摘要。 */
function TrackingPackageCard({ order, packageSummary }: TrackingPackageCardProps) {
  return (
    <View className="gap-4 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="inventory-2" size={18} color={Colors.primaryContainer} />
        <Text className="text-base font-bold text-on-surface">{trackingCopy.sections.package}</Text>
      </View>

      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          {packageSummary.imageUrls.length > 0 ? (
            packageSummary.imageUrls.slice(0, 3).map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                contentFit="cover"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: Colors.surface,
                }}
              />
            ))
          ) : (
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-background">
              <MaterialIcons name="inventory-2" size={20} color={Colors.outline} />
            </View>
          )}
        </View>

        <Text className="text-sm font-medium text-on-surface">{packageSummary.title}</Text>
        <Text className="text-xs text-outline">
          {`${trackingCopy.packageSummary.itemCountPrefix} ${packageSummary.count} ${trackingCopy.packageSummary.itemCountSuffix}${
            order.gift_wrap ? ` · ${trackingCopy.packageSummary.giftWrapEnabled}` : ""
          }`}
        </Text>
      </View>
    </View>
  );
}

/** 履约进度卡负责承接 buildTrackingTimeline 的纯数据结果。 */
function TrackingTimelineCard({ timeline }: TrackingTimelineCardProps) {
  return (
    <View className="gap-4 rounded-2xl bg-surface-container-low p-4">
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="timeline" size={18} color={Colors.primaryContainer} />
        <Text className="text-base font-bold text-on-surface">{trackingCopy.sections.progress}</Text>
      </View>

      <View className="gap-4">
        {timeline.map((item, index) => {
          const isLast = index === timeline.length - 1;

          return (
            <View key={`${item.title}-${index}`} className="flex-row gap-4">
              <View className="w-6 items-center pt-1">
                <TrackingTimelineMarker state={item.state} />
              </View>
              <View
                className={`flex-1 gap-1 ${isLast ? "" : "border-b border-outline-variant/10 pb-4"}`}
              >
                <Text className="text-sm font-medium text-on-surface">{item.title}</Text>
                <Text className="text-xs leading-5 text-on-surface-variant">{item.detail}</Text>
                <Text className="mt-0.5 text-[10px] text-outline">{item.time}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * 物流追踪页经过重构后，只负责组装 hooks、派生状态与拼装展示组件。
 * 订单读取改为按 id 选择缓存，避免继续依赖单一 currentOrder 带来的全局污染。
 */
export default function TrackingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const userId = useUserStore((state) => state.session?.user?.id);
  const fetchOrderById = useOrderStore((state) => state.fetchOrderById);
  const updateOrder = useOrderStore((state) => state.updateOrder);
  const cancelOrder = useOrderStore((state) => state.cancelOrder);
  const confirmReceive = useOrderStore((state) => state.confirmReceive);
  const currentOrder = useOrderStore((state) =>
    orderId ? state.orderByIdMap[orderId] ?? null : null,
  );
  const currentOrderLoading = useOrderStore((state) =>
    orderId ? Boolean(state.orderLoadingById[orderId]) : false,
  );
  const detailError = useOrderStore((state) =>
    orderId ? state.detailErrorById[orderId] ?? null : null,
  );
  const now = useNow();
  const [actionLoading, setActionLoading] = useState<MockLogisticsAction | null>(null);
  const [requestedOrderId, setRequestedOrderId] = useState<string | null>(null);

  // 单订单详情页优先使用更细粒度的实时订阅，减少无关订单更新带来的干扰。
  useTrackingSubscription(orderId, userId);

  // 页面首次进入或切换订单号时，主动触发详情拉取并记录当前请求目标。
  useEffect(() => {
    if (!orderId) {
      setRequestedOrderId(null);
      return;
    }

    setRequestedOrderId(orderId);
    void fetchOrderById(orderId);
  }, [fetchOrderById, orderId]);

  const { trackingEvents, eventsLoading, replaceTrackingEvents } = useTrackingEvents(
    orderId,
    userId,
    currentOrder?.updated_at,
  );

  // 这些派生数据全部下沉到 useMemo，避免 ScrollView 每次重渲染重复计算。
  const statusMeta = useMemo(
    () => (currentOrder ? getTrackingStatusMeta(currentOrder.status) : null),
    [currentOrder],
  );
  const timeline = useMemo(
    () => (currentOrder ? buildTrackingTimeline(currentOrder) : []),
    [currentOrder],
  );
  const packageSummary = useMemo(
    () => summarizeOrderItems(currentOrder?.order_items),
    [currentOrder?.order_items],
  );

  const canAdvanceLogistics = __DEV__ && currentOrder?.status === "paid";
  const canConfirmReceive = currentOrder?.status === "shipping";
  const paymentDeadline = currentOrder ? getPendingPaymentDeadline(currentOrder.created_at) : null;
  const remainingPaymentMs = paymentDeadline === null ? null : paymentDeadline - now;
  const canRepay =
    currentOrder?.status === "pending" && remainingPaymentMs !== null && remainingPaymentMs > 0;
  const remainingPaymentText =
    canRepay && remainingPaymentMs !== null ? formatRemainingPaymentTime(remainingPaymentMs) : null;
  const paymentMethod = currentOrder
    ? normalizePaymentChannel(currentOrder.payment_channel, currentOrder.payment_method)
    : "alipay";
  const hasRequestedCurrentOrder = requestedOrderId === orderId;

  /** 统一跳转支付页，避免按钮区域内重复拼接路由参数。 */
  const handlePayOrder = useCallback(() => {
    if (!currentOrder) {
      return;
    }

    router.push(
      routes.payment({
        orderId: currentOrder.id,
        total: String(currentOrder.total),
        paymentMethod,
      }),
    );
  }, [currentOrder, paymentMethod, router]);

  /** 取消订单动作继续复用 store action，但页面确认弹窗逻辑统一收口。 */
  const handleCancelOrder = useCallback(() => {
    if (!currentOrder) {
      return;
    }

    showConfirm(
      trackingCopy.actions.cancelTitle,
      trackingCopy.actions.cancelMessage,
      async () => {
        const error = await cancelOrder(currentOrder.id);
        if (error) {
          showModal(trackingCopy.errors.cancelFailedTitle, error, "error");
        }
      },
      {
        icon: "delete",
        confirmText: trackingCopy.actions.cancelConfirm,
        confirmStyle: "destructive",
      },
    );
  }, [cancelOrder, currentOrder]);

  /** 模拟物流推进成功后，立即回写订单状态和最新物流轨迹。 */
  const handleAdvanceLogistics = useCallback(async () => {
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
      replaceTrackingEvents(result.trackingEvents);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : trackingCopy.errors.logisticsUpdateFailedMessage;

      captureError(error, {
        scope: "tracking",
        message: "handleAdvanceLogistics 失败",
        orderId,
      });
      showModal(trackingCopy.errors.logisticsUpdateFailedTitle, message, "error");
    } finally {
      setActionLoading(null);
    }
  }, [currentOrder, orderId, replaceTrackingEvents, updateOrder]);

  /** 确认收货继续走 store action，页面只负责展示确认结果。 */
  const handleConfirmReceive = useCallback(() => {
    if (!currentOrder) {
      return;
    }

    showConfirm(
      trackingCopy.actions.confirmReceiveTitle,
      trackingCopy.actions.confirmReceiveMessage,
      async () => {
        const error = await confirmReceive(currentOrder.id);
        if (error) {
          showModal(trackingCopy.errors.confirmReceiveFailedTitle, error, "error");
          return;
        }

        showModal(
          trackingCopy.actions.receiveConfirmedTitle,
          trackingCopy.actions.receiveConfirmedMessage,
          "success",
        );
      },
      { confirmText: trackingCopy.actions.confirmReceive },
    );
  }, [confirmReceive, currentOrder]);

  // 在详情首次请求期间统一展示页面级 loading，避免先闪空态再切成 loading。
  if (orderId && (!hasRequestedCurrentOrder || (currentOrderLoading && !currentOrder))) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title={trackingCopy.screenTitle} />
        <ScreenState
          variant="loading"
          title={screenStateCopy.trackingLoading.title}
          description={screenStateCopy.trackingLoading.description}
        />
      </View>
    );
  }

  // 缺少订单号、详情加载失败或订单不存在时，统一落到标准状态页。
  if (!orderId || !currentOrder || !statusMeta) {
    const isError = Boolean(detailError);

    return (
      <View className="flex-1 bg-background">
        <AppHeader title={trackingCopy.screenTitle} />
        <ScreenState
          variant={isError ? "error" : "empty"}
          icon="inventory"
          title={isError ? "订单加载失败" : screenStateCopy.trackingMissing.title}
          description={detailError ?? screenStateCopy.trackingMissing.description}
          actionLabel={screenStateCopy.trackingMissing.actionLabel}
          onActionPress={() => router.replace(routes.orders)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader title={trackingCopy.screenTitle} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-8 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <TrackingHeaderCard
          order={currentOrder}
          statusMeta={statusMeta}
          canRepay={canRepay}
          remainingPaymentText={remainingPaymentText}
          onPay={handlePayOrder}
          onCancel={handleCancelOrder}
        />

        <TrackingAddressCard order={currentOrder} />

        <TrackingActionsCard
          order={currentOrder}
          canAdvanceLogistics={canAdvanceLogistics}
          canConfirmReceive={canConfirmReceive}
          actionLoading={actionLoading}
          onAdvanceLogistics={handleAdvanceLogistics}
          onConfirmReceive={handleConfirmReceive}
        />

        <TrackingLatestEventsCard
          trackingEvents={trackingEvents}
          eventsLoading={eventsLoading}
        />

        <TrackingPackageCard order={currentOrder} packageSummary={packageSummary} />

        <TrackingTimelineCard timeline={timeline} />
      </ScrollView>
    </View>
  );
}
