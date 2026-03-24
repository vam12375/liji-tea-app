import {
  buildAlipayOrderString,
  createOutTradeNo,
  formatAmount,
} from "../_shared/alipay.ts";
import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  createServiceClient,
  getRequiredEnv,
  getUserFromRequest,
} from "../_shared/supabase.ts";

interface ProductRow {
  name: string | null;
  price: number | string | null;
}

interface OrderItemRow {
  quantity: number;
  product: ProductRow | null;
}

interface OrderRow {
  id: string;
  user_id: string;
  status: string;
  total: number | string | null;
  delivery_type: string | null;
  gift_wrap: boolean | null;
  payment_status: string | null;
  payment_channel: string | null;
  out_trade_no: string | null;
  order_items: OrderItemRow[] | null;
}

/** 兼容数据库 numeric / text 返回值。 */
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 服务端重算订单金额，客户端传入金额不作为可信依据。 */
function calculateOrderAmount(order: OrderRow) {
  const subtotal = (order.order_items ?? []).reduce((sum, item) => {
    const unitPrice = toNumber(item.product?.price);
    return sum + unitPrice * item.quantity;
  }, 0);
  const shippingCost = order.delivery_type === "express" ? 15 : 0;
  const discount = subtotal >= 1000 ? 50 : 0;
  const giftWrapPrice = order.gift_wrap ? 28 : 0;

  return subtotal + shippingCost - discount + giftWrapPrice;
}

/** 生成给支付宝展示的订单标题。 */
function buildOrderSubject(orderItems: OrderItemRow[]) {
  const firstProductName = orderItems[0]?.product?.name?.trim();

  if (!firstProductName) {
    return "李记茶订单";
  }

  if (orderItems.length === 1) {
    return `李记茶 · ${firstProductName}`;
  }

  return `李记茶 · ${firstProductName} 等${orderItems.length}件商品`;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse("仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return errorResponse("未登录或登录状态已失效。", 401, "unauthorized");
    }

    const requestBody = await req.json().catch(() => null);
    const orderId =
      requestBody && typeof requestBody.orderId === "string"
        ? requestBody.orderId
        : "";

    if (!orderId) {
      return errorResponse("缺少 orderId。", 400, "missing_order_id");
    }

    const supabase = createServiceClient();
    // 读取订单与订单明细，服务端校验归属和可支付状态。
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, user_id, status, total, delivery_type, gift_wrap, payment_status, payment_channel, out_trade_no, order_items(quantity, product:products(name, price))"
      )
      .eq("id", orderId)
      .single<OrderRow>();

    if (orderError || !order) {
      return errorResponse("订单不存在。", 404, "order_not_found", orderError?.message);
    }

    if (order.user_id !== user.id) {
      return errorResponse("无权访问该订单。", 403, "forbidden");
    }

    if (order.status !== "pending") {
      return errorResponse(
        "当前订单状态不允许再次发起支付。",
        409,
        "invalid_order_status"
      );
    }

    const orderItems = order.order_items ?? [];
    if (orderItems.length === 0) {
      return errorResponse("订单明细为空，无法发起支付。", 422, "empty_order_items");
    }

    const amount = calculateOrderAmount(order);
    if (amount <= 0) {
      return errorResponse("订单金额异常，无法发起支付。", 422, "invalid_amount");
    }

    // 构造支付宝 App 支付单串，私钥仅保留在服务端。
    const outTradeNo = order.out_trade_no || createOutTradeNo(order.id);
    const subject = buildOrderSubject(orderItems);
    const amountText = formatAmount(amount);
    const orderString = await buildAlipayOrderString({
      appId: getRequiredEnv("ALIPAY_APP_ID"),
      privateKeyPem: getRequiredEnv("ALIPAY_PRIVATE_KEY"),
      notifyUrl: getRequiredEnv("ALIPAY_NOTIFY_URL"),
      sellerId: Deno.env.get("ALIPAY_SELLER_ID") ?? undefined,
      outTradeNo,
      subject,
      totalAmount: amountText,
      body: `order_id=${order.id}`,
    });

    const now = new Date().toISOString();
    // 先落订单支付中状态，避免客户端拉起支付后服务端无状态可查。
    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        total: amount,
        payment_channel: "alipay",
        payment_status: "paying",
        out_trade_no: outTradeNo,
        payment_error_code: null,
        payment_error_message: null,
        updated_at: now,
      })
      .eq("id", order.id);

    if (orderUpdateError) {
      return errorResponse(
        "更新订单支付信息失败。",
        500,
        "order_update_failed",
        orderUpdateError.message
      );
    }

    // 同步记录支付流水，保留支付单生成上下文供后续排查。
    const { error: transactionError } = await supabase
      .from("payment_transactions")
      .upsert(
        {
          order_id: order.id,
          user_id: user.id,
          channel: "alipay",
          out_trade_no: outTradeNo,
          amount,
          status: "paying",
          request_payload: {
            orderId: order.id,
            amount: amountText,
            subject,
            itemCount: orderItems.length,
          },
          notify_verified: false,
          updated_at: now,
        },
        {
          onConflict: "out_trade_no",
        }
      );

    if (transactionError) {
      return errorResponse(
        "写入支付流水失败。",
        500,
        "transaction_upsert_failed",
        transactionError.message
      );
    }

    // 返回给客户端的只有支付串和展示字段，不暴露私钥与签名细节。
    return jsonResponse({
      orderString,
      outTradeNo,
      amount: amountText,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "创建支付宝支付单失败。",
      500,
      "internal_error"
    );
  }
});
