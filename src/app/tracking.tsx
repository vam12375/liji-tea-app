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
import { useNow } from "@/hooks/useNow";
import { useTrackingEvents } from "@/hooks/useTrackingEvents";
import { useTrackingSubscription } from "@/hooks/useTrackingSubscription";
import {
  canApplyAfterSale,
  getAfterSaleStatusDescription,
  getAfterSaleStatusLabel,
} from "@/lib/afterSale";
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
import { useAfterSaleStore } from "@/stores/afterSaleStore";
import { showConfirm, showModal } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import { useUserStore } from "@/stores/userStore";

// 物流页仅保留用户端需要的查看与确认能力，不再承载商家侧“模拟发货”操作。
export default function TrackingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const userId = useUserStore((state) => state.session?.user?.id);
  const fetchOrderById = useOrderStore((state) => state.fetchOrderById);
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
  const [requestedOrderId, setRequestedOrderId] = useState<string | null>(null);

  useTrackingSubscription(orderId, userId);

  useEffect(() => {
    if (!orderId) {
      setRequestedOrderId(null);
      return;
    }

    setRequestedOrderId(orderId);
    void fetchOrderById(orderId);
    void fetchRequestByOrderId(orderId);
  }, [fetchOrderById, fetchRequestByOrderId, orderId]);

  const { trackingEvents, eventsLoading } = useTrackingEvents(
    orderId,
    userId,
    currentOrder?.updated_at,
  );

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
  const { canConfirmReceive, canRepay, remainingPaymentText } = useMemo(
    () => getTrackingActionFlags(currentOrder, now),
    [currentOrder, now],
  );
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
          "订单已成功取消，库存会自动释放。",
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

  if (
    orderId &&
    (!hasRequestedCurrentOrder || (currentOrderLoading && !currentOrder))
  ) {
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

  if (!orderId || !currentOrder || !statusMeta) {
    const isError = Boolean(detailError);

    return (
      <View className="flex-1 bg-background">
        <AppHeader title={trackingCopy.screenTitle} />
        <ScreenState
          variant={isError ? "error" : "empty"}
          icon="inventory"
          title={isError ? "订单加载失败" : screenStateCopy.trackingMissing.title}
          description={
            detailError ?? screenStateCopy.trackingMissing.description
          }
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
          canConfirmReceive={canConfirmReceive}
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
