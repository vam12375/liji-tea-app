import {
  cancelPendingOrderAndRestoreStock,
  createOrder as createOrderRequest,
} from "@/lib/order";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/stores/userStore";
import type {
  CreateOrderParams,
  CreateOrderResponse,
} from "@/lib/order";
import type { Address, Order, OrderItem, Product } from "@/types/database";
import type { OrderPaymentStatus, PaymentChannel } from "@/types/payment";
import { create } from "zustand";

// 订单列表页与详情页都会用这条规则识别超时未支付订单。
const PENDING_ORDER_EXPIRE_MS = 10 * 60 * 1000;

type OrderItemRow = Omit<OrderItem, "product"> & {
  product?: Product | null;
};

// Supabase 查询结果会带可空联表字段，这里单独定义运行时校验前使用的原始结构。
type OrderRow = Omit<Order, "coupon_discount" | "order_items" | "address"> & {
  coupon_discount?: number | null;
  order_items?: OrderItemRow[] | null;
  address?: Address | null;
};

type OrderPaymentPatch = Partial<
  Pick<
    Order,
    | "updated_at"
    | "payment_status"
    | "payment_channel"
    | "out_trade_no"
    | "trade_no"
    | "paid_amount"
    | "paid_at"
    | "payment_error_code"
    | "payment_error_message"
    | "status"
  >
>;

// 下面一组类型守卫负责把 Supabase 返回的 unknown 数据收窄成前端可安全消费的结构。
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isOptionalNullableString(
  value: unknown,
): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

function isOptionalNullableNumber(
  value: unknown,
): value is number | null | undefined {
  return value === undefined || value === null || typeof value === "number";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableStringArray(value: unknown): value is string[] | null {
  return value === null || isStringArray(value);
}

function isPaymentChannel(value: unknown): value is PaymentChannel {
  return value === "alipay" || value === "wechat" || value === "card";
}

function isNullablePaymentChannel(
  value: unknown,
): value is PaymentChannel | null {
  return value === null || isPaymentChannel(value);
}

function isOptionalNullablePaymentChannel(
  value: unknown,
): value is PaymentChannel | null | undefined {
  return value === undefined || isNullablePaymentChannel(value);
}

function isOrderPaymentStatus(
  value: unknown,
): value is OrderPaymentStatus | null | undefined {
  return (
    value === undefined ||
    value === null ||
    value === "pending_payment" ||
    value === "paying" ||
    value === "success" ||
    value === "failed" ||
    value === "closed"
  );
}

function isOrderStatus(value: unknown): value is Order["status"] {
  return (
    value === "pending" ||
    value === "paid" ||
    value === "shipping" ||
    value === "delivered" ||
    value === "cancelled"
  );
}

function isTastingProfile(value: unknown): value is Product["tasting_profile"] {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.every(
        (item) =>
          isRecord(item) &&
          typeof item.label === "string" &&
          typeof item.description === "string" &&
          typeof item.value === "number",
      ))
  );
}

function isBrewingGuide(value: unknown): value is Product["brewing_guide"] {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.temperature === "string" &&
      typeof value.time === "string" &&
      typeof value.amount === "string" &&
      typeof value.equipment === "string")
  );
}

// 订单详情会联表商品信息，这里校验商品结构是否满足页面渲染要求。
function isProductRow(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isNullableString(value.origin) &&
    typeof value.price === "number" &&
    typeof value.unit === "string" &&
    isNullableString(value.image_url) &&
    isNullableString(value.description) &&
    typeof value.is_new === "boolean" &&
    typeof value.category === "string" &&
    isNullableString(value.tagline) &&
    isTastingProfile(value.tasting_profile) &&
    isBrewingGuide(value.brewing_guide) &&
    isNullableString(value.origin_story) &&
    isNullableStringArray(value.process) &&
    typeof value.stock === "number" &&
    typeof value.is_active === "boolean" &&
    typeof value.created_at === "string"
  );
}

function isAddressRow(value: unknown): value is Address {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    typeof value.name === "string" &&
    typeof value.phone === "string" &&
    typeof value.address === "string" &&
    typeof value.is_default === "boolean" &&
    typeof value.created_at === "string"
  );
}

function isOrderItemRow(value: unknown): value is OrderItemRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.order_id === "string" &&
    typeof value.product_id === "string" &&
    typeof value.quantity === "number" &&
    typeof value.unit_price === "number" &&
    (value.product === undefined ||
      value.product === null ||
      isProductRow(value.product))
  );
}

function isOrderRow(value: unknown): value is OrderRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isOptionalNullableString(value.order_no) &&
    typeof value.user_id === "string" &&
    isNullableString(value.address_id) &&
    isOrderStatus(value.status) &&
    typeof value.total === "number" &&
    isOptionalNullableString(value.coupon_id) &&
    isOptionalNullableString(value.user_coupon_id) &&
    isOptionalNullableString(value.coupon_code) &&
    isOptionalNullableString(value.coupon_title) &&
    isOptionalNullableNumber(value.coupon_discount) &&
    typeof value.delivery_type === "string" &&
    isNullablePaymentChannel(value.payment_method) &&
    isOptionalNullablePaymentChannel(value.payment_channel) &&
    isOrderPaymentStatus(value.payment_status) &&
    isOptionalNullableString(value.out_trade_no) &&
    isOptionalNullableNumber(value.paid_amount) &&
    isOptionalNullableString(value.paid_at) &&
    isOptionalNullableString(value.trade_no) &&
    isOptionalNullableString(value.payment_error_code) &&
    isOptionalNullableString(value.payment_error_message) &&
    isOptionalNullableString(value.logistics_company) &&
    isOptionalNullableString(value.logistics_tracking_no) &&
    isOptionalNullableString(value.logistics_status) &&
    isOptionalNullableString(value.logistics_receiver_name) &&
    isOptionalNullableString(value.logistics_receiver_phone) &&
    isOptionalNullableString(value.logistics_address) &&
    isOptionalNullableString(value.shipped_at) &&
    isOptionalNullableString(value.delivered_at) &&
    (typeof value.notes === "string" || value.notes === null) &&
    typeof value.gift_wrap === "boolean" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    (value.order_items === undefined ||
      value.order_items === null ||
      (Array.isArray(value.order_items) &&
        value.order_items.every(isOrderItemRow))) &&
    (value.address === undefined ||
      value.address === null ||
      isAddressRow(value.address))
  );
}

// 将数据库返回的可空字段规范成前端统一使用的 Order / OrderItem 结构。
function normalizeOrderItemRow(row: OrderItemRow): OrderItem {
  return {
    ...row,
    product: row.product ?? undefined,
  };
}

function normalizeOrderRow(row: OrderRow): Order {
  return {
    ...row,
    coupon_discount: row.coupon_discount ?? undefined,
    order_items: row.order_items?.map(normalizeOrderItemRow) ?? undefined,
    address: row.address ?? undefined,
  };
}

// 列表接口返回弱类型数组，这里逐项过滤非法数据，避免污染 store。
function parseOrderList(data: unknown): Order[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const orders: Order[] = [];

  for (const item of data) {
    if (!isOrderRow(item)) {
      console.warn("[orderStore] 跳过不合法订单数据:", item);
      continue;
    }

    orders.push(normalizeOrderRow(item));
  }

  return orders;
}

function parseOrder(data: unknown): Order | null {
  if (!isOrderRow(data)) {
    if (data != null) {
      console.warn("[orderStore] 收到不合法订单详情:", data);
    }
    return null;
  }

  return normalizeOrderRow(data);
}

// 前端在拉单后主动兜底检查超时订单，减少用户看到“假待支付”状态的时间窗口。
function isPendingOrderExpired(order: Pick<Order, "status" | "created_at">) {
  if (order.status !== "pending") {
    return false;
  }

  const createdAt = new Date(order.created_at).getTime();
  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt >= PENDING_ORDER_EXPIRE_MS;
}

// 调用服务端 RPC 关闭超时订单，并返回可直接合并进 store 的状态补丁。
async function closeExpiredPendingOrder(orderId: string) {
  const userId = useUserStore.getState().session?.user?.id;

  if (!userId) {
    return {
      error: new Error("未登录，无法同步超时订单。"),
      update: null,
    };
  }

  const result = await cancelPendingOrderAndRestoreStock(orderId, userId);

  return {
    error: null,
    update: result.released
      ? ({
          status: "cancelled",
          payment_status: "closed",
          payment_error_code: "order_expired",
          payment_error_message: "待付款订单已超过 10 分钟，系统已自动取消。",
          updated_at: new Date().toISOString(),
        } satisfies Partial<Order>)
      : null,
  };
}

// 支付状态更新时只开放必要字段，避免调用方任意覆盖整个订单对象。
export interface PaymentStatusUpdate {
  paymentStatus?: OrderPaymentStatus;
  paymentChannel?: PaymentChannel;
  outTradeNo?: string | null;
  tradeNo?: string | null;
  paidAmount?: number | null;
  paidAt?: string | null;
  paymentErrorCode?: string | null;
  paymentErrorMessage?: string | null;
  status?: Order["status"];
}

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  currentOrderLoading: boolean;
  createOrder: (
    params: CreateOrderParams,
  ) => Promise<{ order: CreateOrderResponse | null; error: string | null }>;
  fetchOrders: () => Promise<void>;
  fetchOrderById: (id: string) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: Order["status"],
  ) => Promise<{ error: string | null }>;
  updatePaymentStatus: (
    orderId: string,
    update: PaymentStatusUpdate,
  ) => Promise<{ error: string | null }>;
  updateOrder: (updated: Partial<Order> & { id: string }) => void;
}

// 订单 store 统一管理下单、拉单、支付状态同步以及当前订单详情。
export const useOrderStore = create<OrderState>()((set) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  currentOrderLoading: false,

  // 创建订单时仅做登录态和错误兜底，核心验价与锁库存都放在服务端完成。
  createOrder: async (params) => {
    try {
      const userId = useUserStore.getState().session?.user?.id;
      if (!userId) {
        return { order: null, error: "未登录" };
      }

      const order = await createOrderRequest(params);
      return { order, error: null };
    } catch (error: unknown) {
      console.warn("[orderStore] createOrder 失败:", error);
      return {
        order: null,
        error: error instanceof Error ? error.message : "创建订单失败",
      };
    }
  },

  // 拉取订单列表后，会顺手清理本地看到的超时待支付订单状态。
  fetchOrders: async () => {
    try {
      const userId = useUserStore.getState().session?.user?.id;
      if (!userId) {
        return;
      }

      set({ loading: true });
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, product:products(*))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const orders = parseOrderList(data);
      const normalizedOrders = await Promise.all(
        orders.map(async (order) => {
          if (!isPendingOrderExpired(order)) {
            return order;
          }

          const result = await closeExpiredPendingOrder(order.id);
          if (result.error) {
            console.warn("[orderStore] 自动关闭超时订单失败:", result.error);
            return order;
          }

          if (!result.update) {
            return order;
          }

          return {
            ...order,
            ...result.update,
          };
        }),
      );

      set({ orders: normalizedOrders, loading: false });
    } catch (error: unknown) {
      console.warn("[orderStore] fetchOrders 失败:", error);
      set({ loading: false });
    }
  },

  // 订单详情页单独拉单，并复用同一套超时订单关闭逻辑。
  fetchOrderById: async (id) => {
    try {
      set({ currentOrder: null, currentOrderLoading: true });

      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, product:products(*)), address:addresses(*)")
        .eq("id", id)
        .single();

      if (error) {
        throw error;
      }

      const parsedOrder = parseOrder(data);
      if (!parsedOrder) {
        set({ currentOrder: null, currentOrderLoading: false });
        return;
      }

      let currentOrder = parsedOrder;

      if (isPendingOrderExpired(currentOrder)) {
        const result = await closeExpiredPendingOrder(currentOrder.id);
        if (result.error) {
          console.warn("[orderStore] 自动关闭超时订单详情失败:", result.error);
        } else if (result.update) {
          currentOrder = {
            ...currentOrder,
            ...result.update,
          };
        }
      }

      set({ currentOrder, currentOrderLoading: false });
    } catch (error: unknown) {
      console.warn("[orderStore] fetchOrderById 失败:", error);
      set({ currentOrder: null, currentOrderLoading: false });
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) {
        return { error: error.message };
      }

      set((state) => ({
        orders: state.orders.map((order) =>
          order.id === orderId ? { ...order, status } : order,
        ),
        currentOrder:
          state.currentOrder?.id === orderId
            ? { ...state.currentOrder, status }
            : state.currentOrder,
      }));

      return { error: null };
    } catch (error: unknown) {
      console.warn("[orderStore] updateOrderStatus 失败:", error);
      return {
        error: error instanceof Error ? error.message : "更新状态失败",
      };
    }
  },

  // 支付回调或轮询结果只增量更新必要字段，再同步回列表和详情缓存。
  updatePaymentStatus: async (orderId, update) => {
    try {
      const dbUpdate: OrderPaymentPatch = {
        updated_at: new Date().toISOString(),
      };

      if (update.paymentStatus !== undefined) {
        dbUpdate.payment_status = update.paymentStatus;
      }
      if (update.paymentChannel !== undefined) {
        dbUpdate.payment_channel = update.paymentChannel;
      }
      if (update.outTradeNo !== undefined) {
        dbUpdate.out_trade_no = update.outTradeNo;
      }
      if (update.tradeNo !== undefined) {
        dbUpdate.trade_no = update.tradeNo;
      }
      if (update.paidAmount !== undefined) {
        dbUpdate.paid_amount = update.paidAmount;
      }
      if (update.paidAt !== undefined) {
        dbUpdate.paid_at = update.paidAt;
      }
      if (update.paymentErrorCode !== undefined) {
        dbUpdate.payment_error_code = update.paymentErrorCode;
      }
      if (update.paymentErrorMessage !== undefined) {
        dbUpdate.payment_error_message = update.paymentErrorMessage;
      }
      if (update.status !== undefined) {
        dbUpdate.status = update.status;
      }

      const { error } = await supabase
        .from("orders")
        .update(dbUpdate)
        .eq("id", orderId);

      if (error) {
        return { error: error.message };
      }

      set((state) => ({
        orders: state.orders.map((order) =>
          order.id === orderId ? { ...order, ...dbUpdate } : order,
        ),
        currentOrder:
          state.currentOrder?.id === orderId
            ? { ...state.currentOrder, ...dbUpdate }
            : state.currentOrder,
      }));

      return { error: null };
    } catch (error: unknown) {
      console.warn("[orderStore] updatePaymentStatus 失败:", error);
      return {
        error: error instanceof Error ? error.message : "更新支付状态失败",
      };
    }
  },

  // 允许页面在拿到局部新数据时同步覆盖当前缓存，避免重复发起整单查询。
  updateOrder: (updated) => {
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === updated.id ? { ...order, ...updated } : order,
      ),
      currentOrder:
        state.currentOrder?.id === updated.id
          ? { ...state.currentOrder, ...updated }
          : state.currentOrder,
    }));
  },
}));
