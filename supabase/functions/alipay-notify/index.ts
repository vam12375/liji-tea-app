declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

import {
  formatAmount,
  parseFormBody,
  verifyAlipaySignature,
} from "../_shared/alipay.ts";
import { handleCors, textResponse } from "../_shared/http.ts";
import {
  calculateOrderAmount,
  fetchPaymentOrderById,
  formatAmountNumber,
  markOrderPaid,
  type PaymentOrderRow,
} from "../_shared/payment.ts";
import { createServiceClient, getRequiredEnv } from "../_shared/supabase.ts";

/** 兼容数据库 numeric / text 返回值。 */
function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 将支付宝交易状态映射到系统内的支付状态。 */
function mapTradeStatus(tradeStatus: string) {
  if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
    return "success";
  }

  if (tradeStatus === "TRADE_CLOSED") {
    return "closed";
  }

  return "paying";
}

function buildAbnormalPaidNotifyMessage(order: PaymentOrderRow) {
  if (order.status === "cancelled") {
    return "订单已取消或已释放库存，但收到支付宝成功回调，已标记为异常单待处理。";
  }

  return `订单当前状态为 ${order.status}，但收到支付宝成功回调，已标记为异常单待处理。`;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return textResponse(req, "failure", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return textResponse(req, "failure", { status: 400 });
    }

    const params = parseFormBody(rawBody);
    const outTradeNo = params.out_trade_no ?? "";

    if (!outTradeNo) {
      return textResponse(req, "failure", { status: 400 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const publicKey = getRequiredEnv("ALIPAY_PUBLIC_KEY");
    const expectedAppId = getRequiredEnv("ALIPAY_APP_ID");
    const expectedSellerId = Deno.env.get("ALIPAY_SELLER_ID");
    const verified = await verifyAlipaySignature(params, publicKey);

    // 通过商户支付单号定位订单，notify 不依赖客户端 token。
    const { data: matchedOrder, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("out_trade_no", outTradeNo)
      .maybeSingle<{ id: string }>();

    if (orderError || !matchedOrder) {
      return textResponse(req, "failure", { status: 404 });
    }

    const { data: order, error: paymentOrderError } = await fetchPaymentOrderById(matchedOrder.id);

    if (paymentOrderError || !order) {
      return textResponse(req, "failure", { status: 404 });
    }

    const tradeStatus = params.trade_status ?? "";
    const normalizedTradeStatus = mapTradeStatus(tradeStatus);
    const totalAmount = toNumber(params.total_amount);

    // 无论验签是否成功，先保存 notify 原文，便于后续排查问题。
    await supabase.from("payment_transactions").upsert(
      {
        order_id: order.id,
        user_id: order.user_id,
        channel: "alipay",
        out_trade_no: outTradeNo,
        trade_no: params.trade_no ?? null,
        amount: totalAmount,
        status: normalizedTradeStatus,
        notify_payload: params,
        notify_verified: verified,
        updated_at: now,
      },
      {
        onConflict: "out_trade_no",
      }
    );

    // 先验签，再做 app_id、seller_id、金额等业务校验。
    if (!verified) {
      return textResponse(req, "failure", { status: 400 });
    }

    if (params.app_id !== expectedAppId) {
      return textResponse(req, "failure", { status: 400 });
    }

    if (
      expectedSellerId &&
      params.seller_id &&
      params.seller_id !== expectedSellerId
    ) {
      return textResponse(req, "failure", { status: 400 });
    }

    if (formatAmount(totalAmount) !== formatAmount(formatAmountNumber(calculateOrderAmount(order)))) {
      await supabase
        .from("orders")
        .update({
          payment_status: "failed",
          payment_error_code: "amount_mismatch",
          payment_error_message: "支付宝回调金额与订单金额不一致",
          updated_at: now,
        })
        .eq("id", order.id);

      return textResponse(req, "failure", { status: 400 });
    }

    // 已经成功入账的订单直接返回 success，保证 notify 幂等。
    if (order.status === "paid" && order.payment_status === "success") {
      return textResponse(req, "success");
    }

    if (normalizedTradeStatus === "success" && order.status !== "pending") {
      const abnormalMessage = buildAbnormalPaidNotifyMessage(order);

      const { error: abnormalOrderError } = await supabase
        .from("orders")
        .update({
          payment_channel: "alipay",
          payment_status: "failed",
          payment_error_code: "abnormal_paid_notify",
          payment_error_message: abnormalMessage,
          updated_at: now,
        })
        .eq("id", order.id)
        .neq("status", "paid");

      if (abnormalOrderError) {
        return textResponse(req, "failure", { status: 500 });
      }

      await supabase
        .from("payment_transactions")
        .update({
          notify_payload: {
            ...params,
            abnormal_order: true,
            abnormal_reason: abnormalMessage,
            abnormal_detected_at: now,
          },
          notify_verified: true,
          updated_at: now,
        })
        .eq("out_trade_no", outTradeNo);

      return textResponse(req, "success");
    }

    if (normalizedTradeStatus === "success") {
      const { error: paidError } = await markOrderPaid({
        order,
        channel: "alipay",
        paymentStatus: "success",
        outTradeNo,
        tradeNo: params.trade_no ?? outTradeNo,
        paidAt: now,
        paidAmount: totalAmount,
        requestPayload: null,
        notifyPayload: params,
        notifyVerified: true,
      });

      if (paidError) {
        return textResponse(req, "failure", { status: 500 });
      }

      return textResponse(req, "success");
    }

    const orderUpdate: Record<string, unknown> = {
      payment_channel: "alipay",
      payment_status: normalizedTradeStatus,
      out_trade_no: outTradeNo,
      trade_no: params.trade_no ?? null,
      payment_error_code:
        normalizedTradeStatus === "closed" ? tradeStatus || "TRADE_CLOSED" : null,
      payment_error_message:
        normalizedTradeStatus === "closed" ? "支付宝订单已关闭" : null,
      updated_at: now,
    };

    const { error: updateError } = await supabase
      .from("orders")
      .update(orderUpdate)
      .eq("id", order.id);

    if (updateError) {
      return textResponse(req, "failure", { status: 500 });
    }

    // 支付宝要求 notify 成功时返回纯文本 success。
    return textResponse(req, "success");
  } catch {
    return textResponse(req, "failure", { status: 500 });
  }
});
