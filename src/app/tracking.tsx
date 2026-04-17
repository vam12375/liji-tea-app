import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { TrackingActionsCard } from "@/components/tracking/TrackingActionsCard";
import { TrackingAddressCard } from "@/components/tracking/TrackingAddressCard";
import { TrackingHeaderCard } from "@/components/tracking/TrackingHeaderCard";
import { TrackingLatestEventsCard } from "@/components/tracking/TrackingLatestEventsCard";
import { TrackingPackageCard } from "@/components/tracking/TrackingPackageCard";
import { TrackingTimelineCard } from "@/components/tracking/TrackingTimelineCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { screenStateCopy, trackingCopy } from "@/constants/copy";
import { useTrackingEvents } from "@/hooks/useTrackingEvents";
import { useNow } from "@/hooks/useNow";
import {
  canApplyAfterSale,
  getAfterSaleStatusDescription,
  getAfterSaleStatusLabel,
} from "@/lib/afterSale";
import { useTrackingSubscription } from "@/hooks/useTrackingSubscription";
import { captureError } from "@/lib/logger";
import { updateMockLogistics } from "@/lib/payment";
import { routes } from "@/lib/routes";
import {
  getTrackingActionFlags,
  normalizeTrackingPaymentChannel,
} from "@/lib/trackingOrder";
import {
  buildTrackingTimeline,
  getTrackingStatusMeta,
  summarizeOrderItems,
} from "@/lib/trackingUtils";
import { showConfirm, showModal } from "@/stores/modalStore";
import { useAfterSaleStore } from "@/stores/afterSaleStore";
import { useOrderStore } from "@/stores/orderStore";
import { useUserStore } from "@/stores/userStore";
import type { Order } from "@/types/database";
import type { MockLogisticsAction } from "@/types/payment";

/**
 * 物流追踪页经过拆分后，只负责组装 hooks、派生状态与展示组件。
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
  const fetchRequestByOrderId = useAfterSaleStore(
    (state) => state.fetchRequestByOrderId,
  );
  const orderAfterSaleRequest = useAfterSaleStore((state) =>
    orderId ? state.requestByOrderId[orderId] ?? null : null,
  );
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
  const [actionLoading, setActionLoading] = useState<MockLogisticsAction | null>(
    null,
  );
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
    void fetchRequestByOrderId(orderId);
  }, [fetchOrderById, fetchRequestByOrderId, orderId]);

  const { trackingEvents, eventsLoading, replaceTrackingEvents } =
    useTrackingEvents(orderId, userId, currentOrder?.updated_at);

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
  const {
    canAdvanceLogistics,
    canConfirmReceive,
    canRepay,
    remainingPaymentText,
  } = useMemo(() => getTrackingActionFlags(currentOrder, now), [currentOrder, now]);
  const paymentMethod = currentOrder
    ? normalizeTrackingPaymentChannel(
        currentOrder.payment_channel,
        currentOrder.payment_method,
      )
    : "alipay";
  const hasRequestedCurrentOrder = requestedOrderId === orderId;
  const canOpenAfterSaleApply = canApplyAfterSale(currentOrder);
  const shouldShowAfterSaleCard =
    Boolean(orderAfterSaleRequest) || canOpenAfterSaleApply;

  // 统一跳转支付页，避免按钮区域内重复拼接路由参数。
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

  // 取消订单动作继续复用 store action，但页面确认弹窗逻辑统一收口。
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
          return;
        }

        showModal(
          trackingCopy.actions.cancelTitle,
          "订单已成功取消，库存已自动释放。",
          "success",
        );
      },
      {
        icon: "delete",
        confirmText: trackingCopy.actions.cancelConfirm,
        confirmStyle: "destructive",
      },
    );
  }, [cancelOrder, currentOrder]);

  // 模拟物流推进成功后，立即回写订单状态和最新物流轨迹。
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

  // 确认收货继续走 store action，页面只负责展示确认结果。
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

  const handleOpenAfterSale = useCallback(() => {
    if (orderAfterSaleRequest) {
      router.push(routes.afterSaleDetail(orderAfterSaleRequest.id));
      return;
    }

    if (orderId) {
      router.push(routes.afterSaleApply(orderId));
    }
  }, [orderAfterSaleRequest, orderId, router]);

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

        {shouldShowAfterSaleCard ? (
          <View className="gap-3 rounded-2xl bg-surface-container-low p-4">
            <View className="gap-1">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-on-surface">
                      售后服务
                    </Text>
                    {orderAfterSaleRequest ? (
                      <View className="rounded-full bg-primary/10 px-2 py-1">
                        <Text className="text-[10px] font-medium text-primary">
                          {getAfterSaleStatusLabel(orderAfterSaleRequest.status)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-xs leading-5 text-on-surface-variant">
                    {orderAfterSaleRequest
                      ? getAfterSaleStatusDescription(orderAfterSaleRequest.status)
                      : "若订单存在质量、包装或配送异常，可从这里发起退款申请。"}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={handleOpenAfterSale}
              className="items-center justify-center rounded-full border border-outline-variant py-3 active:opacity-70"
            >
              <Text className="font-medium text-on-surface">
                {orderAfterSaleRequest
                  ? trackingCopy.actions.viewAfterSale
                  : trackingCopy.actions.applyRefund}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <TrackingLatestEventsCard
          trackingEvents={trackingEvents}
          eventsLoading={eventsLoading}
        />

        <TrackingPackageCard
          order={currentOrder}
          packageSummary={packageSummary}
        />

        <TrackingTimelineCard timeline={timeline} />
      </ScrollView>
    </View>
  );
}
