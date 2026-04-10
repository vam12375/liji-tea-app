import { closeAlipayTrade } from "./alipay.ts";
import { releaseLockedCoupon, type AppliedCouponSummary } from "./coupon.ts";
import { createServiceClient, getRequiredEnv } from "./supabase.ts";

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
  coupon_id: string | null;
  user_coupon_id: string | null;
  coupon_code: string | null;
  coupon_title: string | null;
  coupon_discount: number | string | null;
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
  out_trade_no?: string | null;
  payment_channel?: string | null;
}

export interface TrackingEventInput {
  status: string;
  title: string;
  detail: string;
  eventTime: string;
  sortOrder: number;
}

// 待付款订单的统一过期时长，客户端与服务端都以这个规则进行兜底处理。
const PENDING_ORDER_EXPIRE_MS = 5 * 60 * 1000;
// 订单计价规则常量统一放在服务端，避免客户端自行改价。
const SHIPPING_EXPRESS = 15;
const DISCOUNT_THRESHOLD = 1000;
const DISCOUNT_AMOUNT = 50;
const GIFT_WRAP_PRICE = 28;

export interface OrderPricingLineItem {
  quantity: number;
  unit_price: number;
}

export interface OrderPricingBreakdown {
  subtotal: number;
  shipping: number;
  discount: number;
  autoDiscount: number;
  couponDiscount: number;
  giftWrapFee: number;
  total: number;
  appliedCoupon: AppliedCouponSummary | null;
}

export interface CalculateOrderPricingOptions {
  couponDiscount?: number | null;
  appliedCoupon?: AppliedCouponSummary | null;
}

// 兼容 numeric / text / null 等数据库返回值，统一转成 number 参与计算。
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number) {
  return Number(toNumber(value).toFixed(2));
}

// 将金额统一规范到两位小数，避免订单总价与支付金额出现精度差异。
export function formatAmountNumber(value: number | string | null | undefined) {
  return roundCurrency(toNumber(value));
}

// 服务端统一计算订单金额，自动优惠、优惠券和礼盒费都在这里汇总。
export function calculateOrderPricing(
  items: OrderPricingLineItem[],
  deliveryType?: string | null,
  giftWrap?: boolean | null,
  options?: CalculateOrderPricingOptions,
): OrderPricingBreakdown {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
  );
  const shipping = deliveryType === "express" ? SHIPPING_EXPRESS : 0;
  const autoDiscount = subtotal >= DISCOUNT_THRESHOLD ? DISCOUNT_AMOUNT : 0;
  const couponDiscount = roundCurrency(options?.couponDiscount ?? 0);
  const discount = roundCurrency(autoDiscount + couponDiscount);
  const giftWrapFee = giftWrap ? GIFT_WRAP_PRICE : 0;
  const total = roundCurrency(subtotal + shipping - discount + giftWrapFee);

  return {
    subtotal,
    shipping,
    discount,
    autoDiscount,
    couponDiscount,
    giftWrapFee,
    total,
    appliedCoupon: options?.appliedCoupon ?? null,
  };
}

// 基于订单明细重新反推应付金额，支付前会用它校验数据库中的订单金额。
export function calculateOrderAmount(
  order: Pick<
    PaymentOrderRow,
    "delivery_type" | "gift_wrap" | "coupon_discount" | "order_items"
  >,
) {
  return calculateOrderPricing(
    (order.order_items ?? []).map((item) => ({
      quantity: item.quantity,
      unit_price: toNumber(item.product?.price),
    })),
    order.delivery_type,
    order.gift_wrap,
    {
      couponDiscount: toNumber(order.coupon_discount),
    },
  ).total;
}

// 生成支付渠道展示的订单标题，优先展示首件商品名称。
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

// 生成内部物流单号，保证演示环境下也有稳定的追踪编号。
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

// 支付成功后批量生成订单轨迹事件，便于订单详情和物流页直接展示。
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

// 判断订单是否已超过待支付时效，供支付创建和订单列表兜底使用。
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

async function closeExpiredAlipayTrade(order: PendingOrderSnapshot) {
  if (!order.out_trade_no) {
    return {
      attempted: false,
      success: false,
      result: null,
      error: null,
    };
  }

  if (order.payment_channel && order.payment_channel !== "alipay") {
    return {
      attempted: false,
      success: false,
      result: null,
      error: null,
    };
  }

  try {
    const result = await closeAlipayTrade({
      gatewayUrl: getRequiredEnv("ALIPAY_GATEWAY"),
      appId: getRequiredEnv("ALIPAY_APP_ID"),
      privateKeyPem: getRequiredEnv("ALIPAY_PRIVATE_KEY"),
      outTradeNo: order.out_trade_no,
    });

    if (result.success || result.subCode === "ACQ.TRADE_NOT_EXIST") {
      return {
        attempted: true,
        success: true,
        result,
        error: null,
      };
    }

    return {
      attempted: true,
      success: false,
      result,
      error: new Error(
        `支付宝关单失败：${result.message}${
          result.subCode ? ` (${result.subCode})` : ""
        }`,
      ),
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      result: null,
      error:
        error instanceof Error ? error : new Error("调用支付宝关单接口失败。"),
    };
  }
}

// 关闭超时待付款订单，同时关闭支付流水并释放已锁定优惠券。
export async function closeExpiredPendingOrder(order: PendingOrderSnapshot) {
  if (!isPendingOrderExpired(order)) {
    return { expired: false, error: null };
  }

  const remoteCloseResult = await closeExpiredAlipayTrade(order);

  if (remoteCloseResult.error) {
    return { expired: true, error: remoteCloseResult.error };
  }

  const supabase = createServiceClient();
  const { data: cancelOrderResult, error: cancelOrderError } = await supabase.rpc(
    "cancel_pending_order_and_restore_stock",
    {
 p_order_id: order.id,
      p_user_id: null,
      p_payment_status: "closed",
      p_payment_error_code: "order_expired",
      p_payment_error_message: "待付款订单已超过 5 分钟，系统已自动取消。",
    },
  );

  if (cancelOrderError) {
    return { expired: true, error: cancelOrderError };
  }

  const cancelResultRow = Array.isArray(cancelOrderResult)
    ? cancelOrderResult[0]
    : cancelOrderResult;
  const released =
    cancelResultRow &&
    typeof cancelResultRow === "object" &&
    "released" in cancelResultRow &&
 cancelResultRow.released === true;

  if (!released) {
    return { expired: true, error: null };
  }

  const { error: transactionError } = await supabase
    .from("payment_transactions")
    .update({
      status: "closed",
      notify_payload: {
        type: "order_expired",
        cancelled_at: new Date().toISOString(),
        alipay_close: remoteCloseResult.attempted ? remoteCloseResult.result : null,
      },
      notify_verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", order.id)
    .in("status", ["created", "paying"]);

  if (transactionError) {
    return { expired: true, error: transactionError };
  }

  return { expired: true, error: null };
}

// 拉取支付侧所需的订单完整快照，供回调验签与订单状态查询复用。
export async function fetchPaymentOrderById(orderId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, user_id, status, created_at, total, coupon_id, user_coupon_id, coupon_code, coupon_title, coupon_discount, delivery_type, gift_wrap, payment_method, payment_channel, payment_status, out_trade_no, paid_amount, paid_at, trade_no, payment_error_code, payment_error_message, logistics_company, logistics_tracking_no, logistics_status, logistics_receiver_name, logistics_receiver_phone, logistics_address, shipped_at, delivered_at, address:addresses(name, phone, address), order_items(quantity, product:products(name, price))",
    )
    .eq("id", orderId)
    .single<PaymentOrderRow>();

  return { data, error };
}

// 支付成功后的统一收口：更新订单、流水、优惠券状态以及物流轨迹。
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

  const { error } = await supabase.rpc("mark_order_paid_atomic", {
    p_order_id: params.order.id,
    p_channel: params.channel,
    p_payment_status: params.paymentStatus,
    p_out_trade_no: params.outTradeNo,
    p_trade_no: params.tradeNo,
    p_paid_at: now,
    p_paid_amount: amount,
    p_payment_error_code: params.paymentErrorCode ?? null,
    p_payment_error_message: params.paymentErrorMessage ?? null,
    p_request_payload: params.requestPayload ?? null,
    p_notify_payload: params.notifyPayload ?? null,
    p_notify_verified: params.notifyVerified ?? false,
    p_logistics_company: logistics.company,
    p_logistics_tracking_no: logistics.trackingNo,
    p_logistics_receiver_name:
      params.order.logistics_receiver_name ||
      params.order.address?.name ||
      null,
    p_logistics_receiver_phone:
      params.order.logistics_receiver_phone ||
      params.order.address?.phone ||
      null,
    p_logistics_address:
      params.order.logistics_address || params.order.address?.address || null,
    p_tracking_events: logistics.events.map((event) => ({
      status: event.status,
      title: event.title,
      detail: event.detail,
      event_time: event.eventTime,
      sort_order: event.sortOrder,
    })),
  });

  if (error) {
    return { error };
  }

  return {
    error: null,
    paidAt: now,
    paidAmount: amount,
    logisticsCompany: logistics.company,
    logisticsTrackingNo: logistics.trackingNo,
  };
}
