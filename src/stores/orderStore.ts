import { track } from "@/lib/analytics";
import {
  cancelOrderAction,
  confirmReceiveAction,
  applyExpiredPendingOrderState,
} from "@/lib/orderActions";
import { createOrder as createOrderRequest } from "@/lib/order";
import { captureError } from "@/lib/logger";
import { fetchOrderDetail, fetchOrdersPage } from "@/lib/orderQueries";
import { useUserStore } from "@/stores/userStore";
import type {
  CreateOrderParams,
  CreateOrderResponse,
} from "@/lib/order";
import type { Order } from "@/types/database";
import { create } from "zustand";

interface OrderCacheState {
  orders: Order[];
  orderByIdMap: Record<string, Order>;
  currentOrderId: string | null;
  currentOrder: Order | null;
}

function mergeOrderList(existing: Order[], incoming: Order[]) {
  if (existing.length === 0) {
    return incoming;
  }

  const existingIds = new Set(existing.map((order) => order.id));
  const incomingById = new Map(incoming.map((order) => [order.id, order]));

  const mergedExisting = existing.map((order) => {
    const next = incomingById.get(order.id);
    return next ? { ...order, ...next } : order;
  });

  const appended = incoming.filter((order) => !existingIds.has(order.id));
  return [...mergedExisting, ...appended];
}

function upsertOrderList(existing: Order[], nextOrder: Order) {
  const index = existing.findIndex((order) => order.id === nextOrder.id);
  if (index === -1) {
    return [nextOrder, ...existing];
  }

  return existing.map((order) => (order.id === nextOrder.id ? nextOrder : order));
}

function mergeOrderByIdMap(
  existing: Record<string, Order>,
  orders: Order[],
): Record<string, Order> {
  const next = { ...existing };

  for (const order of orders) {
    next[order.id] = order;
  }

  return next;
}

function putOrderIntoState(state: OrderCacheState, order: Order) {
  const orderByIdMap = {
    ...state.orderByIdMap,
    [order.id]: order,
  };

  return {
    orders: upsertOrderList(state.orders, order),
    orderByIdMap,
    currentOrder:
      state.currentOrderId === order.id
        ? orderByIdMap[order.id] ?? order
        : state.currentOrder,
  };
}

function applyPartialOrderUpdateToState(
  state: OrderCacheState,
  updated: Partial<Order> & { id: string },
) {
  const orders = state.orders.map((order) =>
    order.id === updated.id ? { ...order, ...updated } : order,
  );
  const knownOrder =
    state.orderByIdMap[updated.id] ??
    orders.find((order) => order.id === updated.id) ??
    (state.currentOrder?.id === updated.id ? state.currentOrder : null);

  const orderByIdMap = knownOrder
    ? {
        ...state.orderByIdMap,
        [updated.id]: { ...knownOrder, ...updated },
      }
    : state.orderByIdMap;

  return {
    orders,
    orderByIdMap,
    currentOrder:
      state.currentOrderId === updated.id
        ? orderByIdMap[updated.id] ??
          (state.currentOrder?.id === updated.id
            ? { ...state.currentOrder, ...updated }
            : null)
        : state.currentOrder,
  };
}

function buildEmptyOrderState() {
  return {
    orders: [],
    orderByIdMap: {},
    currentOrderId: null,
    currentOrder: null,
    currentOrderLoading: false,
    loading: false,
    isInitialLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMoreOrders: true,
    ordersPage: 0,
    listError: null,
    detailErrorById: {},
    orderLoadingById: {},
  };
}

interface OrderState {
  orders: Order[];
  orderByIdMap: Record<string, Order>;
  orderLoadingById: Record<string, boolean>;
  detailErrorById: Record<string, string | null | undefined>;
  currentOrderId: string | null;
  currentOrder: Order | null;
  loading: boolean;
  currentOrderLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMoreOrders: boolean;
  ordersPage: number;
  listError: string | null;
  createOrder: (
    params: CreateOrderParams,
  ) => Promise<{ order: CreateOrderResponse | null; error: string | null }>;
  fetchOrders: (loadMore?: boolean) => Promise<void>;
  refreshOrders: () => Promise<void>;
  loadMoreOrders: () => Promise<void>;
  fetchOrderById: (id: string) => Promise<void>;
  getOrderById: (id: string) => Order | null;
  isOrderLoadingById: (id: string) => boolean;
  updateOrder: (updated: Partial<Order> & { id: string }) => void;
  cancelOrder: (orderId: string) => Promise<string | null>;
  confirmReceive: (orderId: string) => Promise<string | null>;
}

/** 订单 store 只保留状态、缓存与 action 编排。 */
export const useOrderStore = create<OrderState>()((set, get) => ({
  ...buildEmptyOrderState(),

  createOrder: async (params) => {
    try {
      const userId = useUserStore.getState().session?.user?.id;
      if (!userId) {
        return { order: null, error: "未登录" };
      }

      const order = await createOrderRequest(params);
      return { order, error: null };
    } catch (error: unknown) {
      captureError(error, {
        scope: "orderStore",
        message: "createOrder 失败",
      });

      return {
        order: null,
        error: error instanceof Error ? error.message : "创建订单失败",
      };
    }
  },

  fetchOrders: async (loadMore = false) => {
    if (loadMore) {
      await get().loadMoreOrders();
      return;
    }

    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      set(buildEmptyOrderState());
      return;
    }

    const hasExistingOrders = get().orders.length > 0;
    if ((!hasExistingOrders && get().isInitialLoading) || (hasExistingOrders && get().isRefreshing)) {
      return;
    }

    set({
      loading: !hasExistingOrders,
      isInitialLoading: !hasExistingOrders,
      isRefreshing: hasExistingOrders,
      isLoadingMore: false,
      listError: null,
    });

    try {
      const result = await fetchOrdersPage({ userId, page: 0 });
      const normalizedOrders = await Promise.all(
        result.orders.map((order) => applyExpiredPendingOrderState(order)),
      );

      set((state) => {
        const orderByIdMap = mergeOrderByIdMap(state.orderByIdMap, normalizedOrders);

        return {
          orders: normalizedOrders,
          orderByIdMap,
          currentOrder: state.currentOrderId
            ? orderByIdMap[state.currentOrderId] ?? state.currentOrder
            : null,
          loading: false,
          isInitialLoading: false,
          isRefreshing: false,
          isLoadingMore: false,
          hasMoreOrders: result.hasMore,
          ordersPage: 1,
          listError: null,
        };
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "拉取订单列表失败";

      track("order_list_fetch_failed", { message });
      captureError(error, {
        scope: "orderStore",
        message: "fetchOrders 失败",
      });

      set({
        loading: false,
        isInitialLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        listError: message,
      });
    }
  },

  refreshOrders: async () => {
    await get().fetchOrders(false);
  },

  loadMoreOrders: async () => {
    const userId = useUserStore.getState().session?.user?.id;
    const { hasMoreOrders, isInitialLoading, isLoadingMore, ordersPage } = get();

    if (!userId || !hasMoreOrders || isInitialLoading || isLoadingMore) {
      return;
    }

    set({ isLoadingMore: true, listError: null });

    try {
      const result = await fetchOrdersPage({ userId, page: ordersPage });
      const normalizedOrders = await Promise.all(
        result.orders.map((order) => applyExpiredPendingOrderState(order)),
      );

      set((state) => {
        const orders = mergeOrderList(state.orders, normalizedOrders);
        const orderByIdMap = mergeOrderByIdMap(state.orderByIdMap, normalizedOrders);

        return {
          orders,
          orderByIdMap,
          currentOrder: state.currentOrderId
            ? orderByIdMap[state.currentOrderId] ?? state.currentOrder
            : null,
          isLoadingMore: false,
          hasMoreOrders: result.hasMore,
          ordersPage: result.page + 1,
        };
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "加载更多订单失败";

      track("order_list_fetch_failed", { message, mode: "load_more" });
      captureError(error, {
        scope: "orderStore",
        message: "loadMoreOrders 失败",
      });

      set({ isLoadingMore: false, listError: message });
    }
  },

  fetchOrderById: async (id) => {
    set((state) => ({
      currentOrderId: id,
      currentOrder: state.orderByIdMap[id] ?? state.currentOrder,
      currentOrderLoading: true,
      detailErrorById: {
        ...state.detailErrorById,
        [id]: null,
      },
      orderLoadingById: {
        ...state.orderLoadingById,
        [id]: true,
      },
    }));

    try {
      const fetchedOrder = await fetchOrderDetail(id);

      if (!fetchedOrder) {
        set((state) => ({
          currentOrder: state.currentOrderId === id ? null : state.currentOrder,
          currentOrderLoading: state.currentOrderId === id ? false : state.currentOrderLoading,
          orderLoadingById: {
            ...state.orderLoadingById,
            [id]: false,
          },
        }));
        return;
      }

      const order = await applyExpiredPendingOrderState(fetchedOrder);

      set((state) => {
        const nextState = putOrderIntoState(state, order);

        return {
          ...nextState,
          currentOrderLoading:
            state.currentOrderId === id ? false : state.currentOrderLoading,
          detailErrorById: {
            ...state.detailErrorById,
            [id]: null,
          },
          orderLoadingById: {
            ...state.orderLoadingById,
            [id]: false,
          },
        };
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "拉取订单详情失败";

      track("order_detail_fetch_failed", { orderId: id, message });
      captureError(error, {
        scope: "orderStore",
        message: "fetchOrderById 失败",
        orderId: id,
      });

      set((state) => ({
        currentOrderLoading:
          state.currentOrderId === id ? false : state.currentOrderLoading,
        currentOrder: state.currentOrderId === id ? null : state.currentOrder,
        detailErrorById: {
          ...state.detailErrorById,
          [id]: message,
        },
        orderLoadingById: {
          ...state.orderLoadingById,
          [id]: false,
        },
      }));
    }
  },

  getOrderById: (id) => get().orderByIdMap[id] ?? null,

  isOrderLoadingById: (id) => Boolean(get().orderLoadingById[id]),

  updateOrder: (updated) => {
    set((state) => applyPartialOrderUpdateToState(state, updated));
  },

  cancelOrder: async (orderId) => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      return "未登录";
    }

    const { error, update } = await cancelOrderAction(orderId, userId);
    if (error || !update) {
      return error ?? "取消订单失败";
    }

    set((state) => applyPartialOrderUpdateToState(state, { id: orderId, ...update }));
    return null;
  },

  confirmReceive: async (orderId) => {
    const userId = useUserStore.getState().session?.user?.id;
    if (!userId) {
      return "未登录";
    }

    const { error, update } = await confirmReceiveAction(orderId, userId);
    if (error || !update) {
      return error ?? "确认收货失败";
    }

    set((state) => applyPartialOrderUpdateToState(state, { id: orderId, ...update }));
    return null;
  },
}));
