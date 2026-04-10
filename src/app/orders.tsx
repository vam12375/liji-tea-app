import { useLocalSearchParams, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import OrderStatusBadge from "@/components/order/OrderStatusBadge";
import PaymentCountdown from "@/components/order/PaymentCountdown";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenState } from "@/components/ui/ScreenState";
import { Colors } from "@/constants/Colors";
import { orderCopy, screenStateCopy } from "@/constants/copy";
import { ORDER_STATUS_TO_TAB, ORDER_TABS } from "@/constants/order";
import { useNow } from "@/hooks/useNow";
import {
  formatRemainingPaymentTime,
  getPendingPaymentDeadline,
} from "@/lib/orderTiming";
import { formatChinaDateTime } from "@/lib/dateTime";
import { routes } from "@/lib/routes";
import { showConfirm, showModal } from "@/stores/modalStore";
import { useOrderStore } from "@/stores/orderStore";
import type { Order } from "@/types/database";

/** 订单页标签名类型，直接从常量中推导，避免手写重复联合类型。 */
type OrdersTabKey = (typeof ORDER_TABS)[number]["key"];

/** 将路由中的初始 tab 参数转换为订单页内部使用的标签 key。 */
function getInitialActiveTab(initialTab?: string): OrdersTabKey {
  if (!initialTab) {
    return "全部";
  }

  return ORDER_STATUS_TO_TAB[initialTab] ?? "全部";
}

/** 订单卡片组件的入参，拆出后便于配合 `memo` 减少无关重渲染。 */
interface OrderCardProps {
  item: Order;
  now: number;
  onPress: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onPay: (order: Order) => void;
}

/**
 * 单个订单卡片只负责展示和交互触发。
 * 页面本身只管理筛选、刷新和分页，从而让职责边界更清晰。
 */
const OrderCard = memo(function OrderCard({
  item,
  now,
  onPress,
  onCancel,
  onPay,
}: OrderCardProps) {
  // 计算订单内商品总件数，便于列表直接展示摘要信息。
  const itemCount = item.order_items?.reduce((sum, orderItem) => sum + orderItem.quantity, 0) ?? 0;

  // 待支付订单需要实时计算剩余支付时长，用于倒计时展示和按钮禁用。
  const paymentDeadline =
    item.status === "pending" ? getPendingPaymentDeadline(item.created_at) : null;
  const remainingMs = paymentDeadline === null ? null : paymentDeadline - now;
  const isPayable =
    item.status === "pending" && remainingMs !== null && remainingMs > 0;
  const remainingText =
    isPayable && remainingMs !== null
      ? formatRemainingPaymentTime(remainingMs)
      : null;

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      className="mx-4 gap-3 rounded-2xl bg-surface-container-low p-4 active:opacity-80"
    >
      {/* 顶部区域展示订单号与订单状态。 */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-on-surface">
          {orderCopy.labels.orderNumber}：{item.order_no ?? item.id.slice(0, 8)}
        </Text>
        <OrderStatusBadge status={item.status} />
      </View>

      {/* 下单时间用于帮助用户快速定位最近订单。 */}
      <Text className="text-xs text-outline">
        {formatChinaDateTime(item.created_at, "--")}
      </Text>

      {/* 待支付订单统一展示倒计时提示卡片。 */}
      {item.status === "pending" ? (
        <PaymentCountdown remainingText={remainingText} isPayable={isPayable} />
      ) : null}

      {/* 底部摘要展示商品件数与订单金额。 */}
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-outline">
          {orderCopy.labels.itemCountPrefix} {itemCount} {orderCopy.labels.itemCountSuffix}
        </Text>
        <Text className="text-base font-bold text-primary">¥{item.total.toFixed(2)}</Text>
      </View>

      {/* 如果订单使用了优惠券，则补充展示优惠摘要。 */}
      {typeof item.coupon_discount === "number" && item.coupon_discount > 0 ? (
        <View className="gap-1 rounded-xl bg-background px-3 py-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-sm font-medium text-on-surface">
                {item.coupon_title
                  ? `${orderCopy.labels.couponUsed}：${item.coupon_title}`
                  : orderCopy.labels.couponUsed}
              </Text>
              <Text className="text-xs leading-5 text-outline">
                {item.coupon_code
                  ? `${orderCopy.labels.couponCode}：${item.coupon_code}`
                  : orderCopy.couponFallback}
              </Text>
            </View>
            <Text className="text-sm font-bold text-primary">
              -¥{item.coupon_discount.toFixed(2)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 待支付订单显示取消和继续支付两个动作按钮。 */}
      {item.status === "pending" ? (
        <View className="flex-row justify-end gap-3">
          <Pressable
            onPress={() => onCancel(item.id)}
            className="rounded-full border border-outline-variant px-5 py-2.5 active:opacity-70"
          >
            <Text className="font-medium text-outline">{orderCopy.actions.cancel}</Text>
          </Pressable>

          <Pressable
            onPress={() => onPay(item)}
            disabled={!isPayable}
            className={`rounded-full px-5 py-2.5 ${
              isPayable ? "bg-primary-container active:bg-primary" : "bg-surface"
            }`}
          >
            <Text
              className={`font-medium ${isPayable ? "text-on-primary" : "text-outline"}`}
            >
              {orderCopy.actions.payNow}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
});

/** 列表底部状态只关注分页加载和“没有更多”两类场景。 */
interface OrdersListFooterProps {
  hasData: boolean;
  isLoadingMore: boolean;
  hasMoreOrders: boolean;
}

/** 订单列表底部提示，避免首屏 loading 与分页 loading 混用同一状态。 */
function OrdersListFooter({
  hasData,
  isLoadingMore,
  hasMoreOrders,
}: OrdersListFooterProps) {
  // 没有数据时不渲染 footer，避免空页面底部出现多余占位。
  if (!hasData) {
    return null;
  }

  if (isLoadingMore) {
    return (
      <View className="items-center py-4">
        <Text className="text-xs text-outline">{orderCopy.listFooter.loadingMore}</Text>
      </View>
    );
  }

  if (!hasMoreOrders) {
    return (
      <View className="items-center py-4">
        <Text className="text-xs text-outline">{orderCopy.listFooter.noMore}</Text>
      </View>
    );
  }

  return null;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { initialTab } = useLocalSearchParams<{ initialTab?: string }>();

  // 初始选中标签由路由参数决定，便于从“待付款/待发货”等入口跳转时直接落到指定 tab。
  const [activeTab, setActiveTab] = useState<OrdersTabKey>(() =>
    getInitialActiveTab(initialTab),
  );

  // 订单页需要持续刷新倒计时，因此统一读取当前时间戳。
  const now = useNow();

  // 只订阅订单页真正关心的状态，避免无关字段变化导致整页重渲染。
  const orders = useOrderStore((state) => state.orders);
  const listError = useOrderStore((state) => state.listError);
  const isInitialLoading = useOrderStore((state) => state.isInitialLoading);
  const isRefreshing = useOrderStore((state) => state.isRefreshing);
  const isLoadingMore = useOrderStore((state) => state.isLoadingMore);
  const hasMoreOrders = useOrderStore((state) => state.hasMoreOrders);
  const fetchOrders = useOrderStore((state) => state.fetchOrders);
  const refreshOrders = useOrderStore((state) => state.refreshOrders);
  const loadMoreOrders = useOrderStore((state) => state.loadMoreOrders);
  const cancelOrder = useOrderStore((state) => state.cancelOrder);

  // 当外部通过路由参数切换 tab 时，同步更新当前页面选中的标签。
  useEffect(() => {
    setActiveTab(getInitialActiveTab(initialTab));
  }, [initialTab]);

  // 页面首次进入时拉取订单列表；分页和刷新由专门 action 负责。
  useEffect(() => {
    void fetchOrders(false);
  }, [fetchOrders]);

  // 按当前标签筛选订单列表，并通过 `useMemo` 避免每次渲染重复过滤数组。
  const filteredOrders = useMemo(() => {
    const activeTabDef = ORDER_TABS.find((tab) => tab.key === activeTab);
    if (!activeTabDef || activeTabDef.status === null) {
      return orders;
    }

    return orders.filter((order) => order.status === activeTabDef.status);
  }, [activeTab, orders]);

  // 打开订单详情时统一跳转到物流追踪页，后续如果变更详情路由只需调整这一处。
  const handleOpenOrder = useCallback(
    (orderId: string) => {
      router.push(routes.tracking(orderId));
    },
    [router],
  );

  // 取消订单前弹出确认框，避免用户误触直接关闭订单。
  const handleCancelOrder = useCallback(
    (orderId: string) => {
      showConfirm(
        orderCopy.actions.cancelTitle,
        orderCopy.actions.cancelMessage,
        async () => {
          const error = await cancelOrder(orderId);
          if (error) {
            showModal(orderCopy.actions.cancelFailedTitle, error, "error");
            return;
          }

          showModal(
            orderCopy.actions.cancelTitle,
            "订单已成功取消，库存已自动释放。",
            "success",
          );
        },
        {
          icon: "delete",
          confirmText: orderCopy.actions.cancelConfirm,
          confirmStyle: "destructive",
        },
      );
    },
    [cancelOrder],
  );

  // 继续支付时沿用统一路由构造函数，保证参数结构稳定。
  const handlePayOrder = useCallback(
    (order: Order) => {
      router.push(
        routes.payment({
          orderId: order.id,
          total: String(order.total),
          paymentMethod: order.payment_channel ?? order.payment_method ?? "alipay",
        }),
      );
    },
    [router],
  );

  // 下拉刷新只走 store 中的刷新 action，保持首屏加载与刷新语义分离。
  const handleRefresh = useCallback(() => {
    void refreshOrders();
  }, [refreshOrders]);

  // 列表项渲染函数用 `useCallback` 固定引用，降低 FlatList 额外更新成本。
  const renderOrder = useCallback(
    ({ item }: { item: Order }) => (
      <OrderCard
        item={item}
        now={now}
        onPress={handleOpenOrder}
        onCancel={handleCancelOrder}
        onPay={handlePayOrder}
      />
    ),
    [handleCancelOrder, handleOpenOrder, handlePayOrder, now],
  );

  return (
    <View className="flex-1 bg-background">
      {/* 使用统一头部组件，后续改标题样式或返回按钮逻辑时只需维护一处。 */}
      <AppHeader title={orderCopy.screenTitle} />

      {/* 顶部标签栏负责切换不同订单状态视图。 */}
      <View className="flex-row border-b border-outline-variant/15 px-2">
        {ORDER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="flex-1 items-center py-3"
            >
              <Text
                className={`text-sm ${isActive ? "font-bold" : "font-normal"}`}
                style={{ color: isActive ? Colors.primary : Colors.outline }}
              >
                {tab.key}
              </Text>
              {isActive ? (
                <View
                  className="absolute bottom-0 h-0.5 w-8 rounded-full"
                  style={{ backgroundColor: Colors.primary }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* 首屏加载、错误、空态与列表态统一在这里切换。 */}
      {isInitialLoading ? (
        <ScreenState
          variant="loading"
          title={screenStateCopy.ordersLoading.title}
          description={screenStateCopy.ordersLoading.description}
        />
      ) : listError && orders.length === 0 ? (
        <ScreenState
          variant="error"
          title="订单加载失败"
          description={listError}
          actionLabel="重新加载"
          onActionPress={() => void fetchOrders(false)}
        />
      ) : filteredOrders.length === 0 ? (
        <ScreenState
          variant="empty"
          icon="receipt-long"
          title={screenStateCopy.ordersEmpty.title}
          description={screenStateCopy.ordersEmpty.description}
        />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerClassName="gap-3 py-4"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          onEndReached={() => void loadMoreOrders()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <OrdersListFooter
              hasData={filteredOrders.length > 0}
              isLoadingMore={isLoadingMore}
              hasMoreOrders={hasMoreOrders}
            />
          }
        />
      )}
    </View>
  );
}
