import { supabase } from "@/lib/supabase";
import {
  classifyMerchantError,
  isMerchantError,
  type MerchantError,
} from "@/lib/merchantErrors";
import type { AfterSaleRequest, Order, Product, UserRoleRow } from "@/types/database";

// 商家端 RPC 封装：页面层只需调 merchantRpc.xxx(...)，底层统一把 Supabase 错误
// 归一化为 MerchantError 抛出；成功时直接返回 RPC payload（已是完整行）。

// Supabase rpc() 返回的是 PostgrestFilterBuilder（thenable 但非 Promise），
// 这里抹平差异：await 它得到 {data, error}，再进入错误归一化。
interface RpcLike<T> {
  then<U>(onfulfilled: (v: { data: T | null; error: unknown }) => U): unknown;
}

async function invoke<T>(fn: () => RpcLike<T>): Promise<T> {
  try {
    const { data, error } = (await fn()) as { data: T | null; error: unknown };
    if (error) throw classifyMerchantError(error);
    if (data === null || data === undefined) {
      throw {
        kind: "unknown",
        message: "服务端未返回结果",
      } satisfies MerchantError;
    }
    return data;
  } catch (err) {
    if (isMerchantError(err)) throw err;
    throw classifyMerchantError(err);
  }
}

export const merchantRpc = {
  // ========== 订单履约 ==========
  shipOrder: (orderId: string, carrier: string, trackingNo: string) =>
    invoke<Order>(() =>
      supabase.rpc("merchant_ship_order", {
        p_order_id: orderId,
        p_carrier: carrier,
        p_tracking_no: trackingNo,
      }),
    ),

  updateTracking: (orderId: string, carrier: string | null, trackingNo: string | null) =>
    invoke<Order>(() =>
      supabase.rpc("merchant_update_tracking", {
        p_order_id: orderId,
        p_carrier: carrier ?? "",
        p_tracking_no: trackingNo ?? "",
      }),
    ),

  closeOrder: (orderId: string, reason: string) =>
    invoke<Order>(() =>
      supabase.rpc("merchant_close_order", {
        p_order_id: orderId,
        p_reason: reason,
      }),
    ),

  // ========== 售后 ==========
  approveRefund: (requestId: string, refundAmount: number, note: string) =>
    invoke<AfterSaleRequest>(() =>
      supabase.rpc("merchant_approve_refund", {
        p_request_id: requestId,
        p_refund_amount: refundAmount,
        p_note: note,
      }),
    ),

  rejectRefund: (requestId: string, reason: string) =>
    invoke<AfterSaleRequest>(() =>
      supabase.rpc("merchant_reject_refund", {
        p_request_id: requestId,
        p_reason: reason,
      }),
    ),

  markRefundCompleted: (requestId: string, txnId: string) =>
    invoke<AfterSaleRequest>(() =>
      supabase.rpc("merchant_mark_refund_completed", {
        p_request_id: requestId,
        p_txn_id: txnId,
      }),
    ),

  // ========== 商品 / 库存 ==========
  updateProduct: (productId: string, patch: Record<string, unknown>) =>
    invoke<Product>(() =>
      supabase.rpc("merchant_update_product", {
        p_product_id: productId,
        p_patch: patch,
      }),
    ),

  updateStock: (productId: string, delta: number, reason: string) =>
    invoke<Product>(() =>
      supabase.rpc("merchant_update_stock", {
        p_product_id: productId,
        p_delta: delta,
        p_reason: reason,
      }),
    ),

  // ========== 角色（仅 admin）==========
  grantRole: (userId: string, role: "admin" | "staff" | null) =>
    invoke<UserRoleRow | null>(() =>
      supabase.rpc("merchant_grant_role", {
        p_user_id: userId,
        p_role: role,
      }),
    ),
};
