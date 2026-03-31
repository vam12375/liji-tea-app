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

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return textResponse("failure", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    if (!rawBody) {
      return textResponse("failure", { status: 400 });
    }

    const params = parseFormBody(rawBody);
    const outTradeNo = params.out_trade_no ?? "";

    if (!outTradeNo) {
      return textResponse("failure", { status: 400 });
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
      return textResponse("failure", { status: 404 });
    }

    const { data: order, error: paymentOrderError } = await fetchPaymentOrderById(matchedOrder.id);

    if (paymentOrderError || !order) {
      return textResponse("failure", { status: 404 });
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
      return textResponse("failure", { status: 400 });
    }

    if (params.app_id !== expectedAppId) {
      return textResponse("failure", { status: 400 });
    }

    if (
      expectedSellerId &&
      params.seller_id &&
      params.seller_id !== expectedSellerId
    ) {
      return textResponse("failure", { status: 400 });
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

      return textResponse("failure", { status: 400 });
    }

    // 已经成功入账的订单直接返回 success，保证 notify 幂等。
    if (order.status === "paid" && order.payment_status === "success") {
      return textResponse("success");
    }

    if (normalizedTradeStatus === "success") {
      const { error: paidError } = await markOrderPaid({
        order: order as PaymentOrderRow,
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
        return textResponse("failure", { status: 500 });
      }

      return textResponse("success");
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
      return textResponse("failure", { status: 500 });
    }

    // 支付宝要求 notify 成功时返回纯文本 success。
    return textResponse("success");
  } catch {
    return textResponse("failure", { status: 500 });
  }
});
