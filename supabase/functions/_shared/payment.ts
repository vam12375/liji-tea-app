import { createServiceClient } from "./supabase.ts";

interface OrderItemProductRow {
  name: string | null;
  price: number | string | null;
}

interface OrderItemRow {
  quantity: number;
  product: OrderItemProductRow | null;
}

interface AddressRow {
  name: string | null;
  phone: string | null;
  address: string | null;
}

export interface PaymentOrderRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  total: number | string | null;
  delivery_type: string | null;
  gift_wrap: boolean | null;
  payment_method: string | null;
  payment_channel: string | null;
  payment_status: string | null;
  out_trade_no: string | null;
  paid_amount: number | string | null;
  paid_at: string | null;
  trade_no: string | null;
  payment_error_code: string | null;
  payment_error_message: string | null;
  logistics_company: string | null;
  logistics_tracking_no: string | null;
  logistics_status: string | null;
  logistics_receiver_name: string | null;
  logistics_receiver_phone: string | null;
  logistics_address: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  address: AddressRow | null;
  order_items: OrderItemRow[] | null;
}

export interface PendingOrderSnapshot {
  id: string;
  status: string;
  created_at: string;
}

export interface TrackingEventInput {
  status: string;
  title: string;
  detail: string;
  eventTime: string;
  sortOrder: number;
}

const PENDING_ORDER_EXPIRE_MS = 10 * 60 * 1000;

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAmountNumber(value: number | string | null | undefined) {
  return Number(toNumber(value).toFixed(2));
}

export function calculateOrderAmount(
  order: Pick<PaymentOrderRow, "delivery_type" | "gift_wrap" | "order_items">,
) {
  const subtotal = (order.order_items ?? []).reduce((sum, item) => {
    const unitPrice = toNumber(item.product?.price);
    return sum + unitPrice * item.quantity;
  }, 0);
  const shippingCost = order.delivery_type === "express" ? 15 : 0;
  const discount = subtotal >= 1000 ? 50 : 0;
  const giftWrapPrice = order.gift_wrap ? 28 : 0;

  return Number(
    (subtotal + shippingCost - discount + giftWrapPrice).toFixed(2),
  );
}

export function buildOrderSubject(orderItems: OrderItemRow[]) {
  const firstProductName = orderItems[0]?.product?.name?.trim();

  if (!firstProductName) {
    return "李记茶订单";
  }

  if (orderItems.length === 1) {
    return `李记茶 · ${firstProductName}`;
  }

  return `李记茶 · ${firstProductName} 等${orderItems.length}件商品`;
}

function createTrackingNo(orderId: string) {
  const normalized = orderId.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  const suffix = normalized.slice(-10).padStart(10, "0");
  return `LJ${Date.now().toString().slice(-8)}${suffix}`;
}

function getLogisticsCompany(deliveryType?: string | null) {
  switch (deliveryType) {
    case "express":
      return "顺丰速运";
    case "pickup":
      return "门店自提";
    default:
      return "李记茶专送";
  }
}

function createTrackingEvents(order: PaymentOrderRow, paidAt: string) {
  const trackingNo = order.logistics_tracking_no || createTrackingNo(order.id);
  const company =
    order.logistics_company || getLogisticsCompany(order.delivery_type);
  const receiverName =
    order.logistics_receiver_name || order.address?.name || "收件人";
  const address =
    order.logistics_address || order.address?.address || "收货地址待补充";
  const itemCount = (order.order_items ?? []).reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const shippedAt = new Date(
    new Date(paidAt).getTime() + 30 * 60 * 1000,
  ).toISOString();
  const inTransitAt = new Date(
    new Date(paidAt).getTime() + 6 * 60 * 60 * 1000,
  ).toISOString();

  const events: TrackingEventInput[] = [
    {
      status: "paid",
      title: "支付成功",
      detail: "系统已确认支付成功，订单进入仓库处理队列。",
      eventTime: paidAt,
      sortOrder: 10,
    },
    {
      status: "packed",
      title: "仓库备货中",
      detail: `仓库正在为您准备${itemCount || 1}件商品，待打包出库。`,
      eventTime: new Date(
        new Date(paidAt).getTime() + 10 * 60 * 1000,
      ).toISOString(),
      sortOrder: 20,
    },
    {
      status: "shipped",
      title: "包裹已出库",
      detail:
        company === "门店自提"
          ? "商品已完成打包，请等待门店通知后前往自提。"
          : `包裹已由${company}揽收，运单号 ${trackingNo}。`,
      eventTime: shippedAt,
      sortOrder: 30,
    },
    {
      status: "in_transit",
      title: company === "门店自提" ? "待到店自提" : "运输途中",
      detail:
        company === "门店自提"
          ? `商品已为 ${receiverName} 预留，请按通知前往门店取货。`
          : `包裹正在发往 ${address}，请留意签收电话。`,
      eventTime: inTransitAt,
      sortOrder: 40,
    },
  ];

  return {
    trackingNo,
    company,
    shippedAt,
    events,
  };
}

export function isPendingOrderExpired(order: PendingOrderSnapshot) {
  if (order.status !== "pending") {
    return false;
  }

  const createdAt = new Date(order.created_at).getTime();
  if (Number.isNaN(createdAt)) {
    return false;
  }

  return Date.now() - createdAt >= PENDING_ORDER_EXPIRE_MS;
}

export async function closeExpiredPendingOrder(order: PendingOrderSnapshot) {
  if (!isPendingOrderExpired(order)) {
    return { expired: false, error: null };
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const orderUpdate = {
    status: "cancelled",
    payment_status: "closed",
    payment_error_code: "order_expired",
    payment_error_message: "待付款订单已超过 10 分钟，系统已自动取消。",
    updated_at: now,
  };

  const { error: orderError } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", order.id)
    .eq("status", "pending");

  if (orderError) {
    return { expired: true, error: orderError };
  }

  const { error: transactionError } = await supabase
    .from("payment_transactions")
    .update({
      status: "closed",
      notify_payload: {
        type: "order_expired",
        cancelled_at: now,
      },
      notify_verified: true,
      updated_at: now,
    })
    .eq("order_id", order.id)
    .in("status", ["created", "paying"]);

  if (transactionError) {
    return { expired: true, error: transactionError };
  }

  return { expired: true, error: null };
}

export async function fetchPaymentOrderById(orderId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, user_id, status, created_at, total, delivery_type, gift_wrap, payment_method, payment_channel, payment_status, out_trade_no, paid_amount, paid_at, trade_no, payment_error_code, payment_error_message, logistics_company, logistics_tracking_no, logistics_status, logistics_receiver_name, logistics_receiver_phone, logistics_address, shipped_at, delivered_at, address:addresses(name, phone, address), order_items(quantity, product:products(name, price))",
    )
    .eq("id", orderId)
    .single<PaymentOrderRow>();

  return { data, error };
}

export async function markOrderPaid(params: {
  order: PaymentOrderRow;
  channel: string;
  paymentStatus: string;
  outTradeNo: string;
  tradeNo: string;
  paidAt?: string;
  paidAmount?: number;
  paymentErrorCode?: string | null;
  paymentErrorMessage?: string | null;
  requestPayload?: Record<string, unknown> | null;
  notifyPayload?: Record<string, unknown> | null;
  notifyVerified?: boolean;
}) {
  const supabase = createServiceClient();
  const now = params.paidAt ?? new Date().toISOString();
  const amount = formatAmountNumber(
    params.paidAmount ?? calculateOrderAmount(params.order),
  );
  const logistics = createTrackingEvents(params.order, now);

  const orderUpdate: Record<string, unknown> = {
    status: "paid",
    payment_channel: params.channel,
    payment_status: params.paymentStatus,
    out_trade_no: params.outTradeNo,
    trade_no: params.tradeNo,
    paid_amount: amount,
    paid_at: now,
    payment_error_code: params.paymentErrorCode ?? null,
    payment_error_message: params.paymentErrorMessage ?? null,
    logistics_company: logistics.company,
    logistics_tracking_no: logistics.trackingNo,
    logistics_status: "pending",
    logistics_receiver_name:
      params.order.logistics_receiver_name ||
      params.order.address?.name ||
      null,
    logistics_receiver_phone:
      params.order.logistics_receiver_phone ||
      params.order.address?.phone ||
      null,
    logistics_address:
      params.order.logistics_address || params.order.address?.address || null,
    shipped_at: null,
    delivered_at: null,
    updated_at: now,
  };

  const { error: orderError } = await supabase
    .from("orders")
    .update(orderUpdate)
    .eq("id", params.order.id);

  if (orderError) {
    return { error: orderError };
  }

  const { error: transactionError } = await supabase
    .from("payment_transactions")
    .upsert(
      {
        order_id: params.order.id,
        user_id: params.order.user_id,
        channel: params.channel,
        out_trade_no: params.outTradeNo,
        trade_no: params.tradeNo,
        amount,
        status: params.paymentStatus,
        request_payload: params.requestPayload ?? null,
        notify_payload: params.notifyPayload ?? null,
        notify_verified: params.notifyVerified ?? false,
        updated_at: now,
      },
      {
        onConflict: "out_trade_no",
      },
    );

  if (transactionError) {
    return { error: transactionError };
  }

  const { error: deleteEventsError } = await supabase
    .from("order_tracking_events")
    .delete()
    .eq("order_id", params.order.id);

  if (deleteEventsError) {
    return { error: deleteEventsError };
  }

  const { error: insertEventsError } = await supabase
    .from("order_tracking_events")
    .insert(
      logistics.events.map((event) => ({
        order_id: params.order.id,
        user_id: params.order.user_id,
        status: event.status,
        title: event.title,
        detail: event.detail,
        event_time: event.eventTime,
        sort_order: event.sortOrder,
      })),
    );

  if (insertEventsError) {
    return { error: insertEventsError };
  }

  return {
    error: null,
    paidAt: now,
    paidAmount: amount,
    logisticsCompany: logistics.company,
    logisticsTrackingNo: logistics.trackingNo,
  };
}
