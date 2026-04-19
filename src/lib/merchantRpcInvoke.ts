// 商家端 RPC 的纯逻辑调用包装器。
//
// 独立成文件的原因：本层只处理 "{ data, error } thenable → T | MerchantError" 的归一化，
// 不依赖 @/lib/supabase，因此可以在纯 Node / tsx 环境下直接单元测试。
// src/lib/merchantRpc.ts 再结合 supabase 客户端使用本文件。

import {
  classifyMerchantError,
  isMerchantError,
  type MerchantError,
} from "@/lib/merchantErrors";

// Supabase rpc() 返回的是 PostgrestFilterBuilder（thenable 但非 Promise），
// 这里抹平差异：await 它得到 {data, error}。
export interface RpcLike<T> {
  then<U>(onfulfilled: (v: { data: T | null; error: unknown }) => U): unknown;
}

/**
 * 商家端 RPC 调用包装器。
 * - 成功：返回 `data`；`data == null` 时视为服务端未返回结果并抛 `MerchantError(unknown)`。
 * - 已归一化错误：原样透传（避免二次 classify 破坏 kind）。
 * - 其他错误：一律交给 `classifyMerchantError` 转成 `MerchantError`。
 */
export async function invoke<T>(fn: () => RpcLike<T>): Promise<T> {
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
