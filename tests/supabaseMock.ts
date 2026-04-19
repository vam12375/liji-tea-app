// 纯 Node 环境下的 Supabase 客户端/响应 mock 基元集合。
//
// 为什么不 mock 整个 Supabase 客户端：
// - 业务真正依赖的核心是"thenable 形态的 { data, error } 响应对象" 与
//   "functions.invoke 的 Promise 形态响应"。把这两个做成可注入的工厂，
//   业务代码只要稍做 DI 就能直测，避免引入 msw / 完整 client mock 的重量。
//
// 本文件不引入任何 react-native / expo / async-storage 依赖，可在 tsx 下直接运行。

import type { RpcLike } from "@/lib/merchantRpcInvoke";

/**
 * 构造一个 Supabase rpc() 风格的 thenable：
 *   `{ data: T|null, error: unknown }` 异步响应。
 *
 * 传入 error 时 data 置 null；传入 data 时 error 置 null，
 * 与真实 Postgrest 客户端语义一致。
 */
export function makeRpcResponse<T>(response: {
  data?: T | null;
  error?: unknown;
}): RpcLike<T> {
  const normalized = response.error
    ? { data: null as T | null, error: response.error }
    : { data: (response.data ?? null) as T | null, error: null };
  return {
    then<U>(onfulfilled: (v: { data: T | null; error: unknown }) => U): unknown {
      return Promise.resolve(onfulfilled(normalized));
    },
  };
}

/**
 * 构造一个 Supabase rpc() 风格的 thenable，但在 await 时直接抛异常，
 * 用于模拟网络中断 / fetch 失败等 Postgrest 客户端之外的错误。
 *
 * 这里直接返回 rejected Promise：真实 Promise 自带两参 `then(onOk, onErr)` 语义，
 * 能正确被 await 捕获；仅定义单参 then 的自制 thenable 会吞掉 rejection。
 */
export function makeRpcRejection<T = never>(error: unknown): RpcLike<T> {
  return Promise.reject(error) as unknown as RpcLike<T>;
}

/** Postgres 权限错误的典型 payload，便于在测试里复用。 */
export function buildPermissionDeniedError(message = "permission_denied") {
  return { code: "42501", message };
}

/** 业务状态冲突错误 payload：来自 merchant_*() RPC 的 raise exception 分支。 */
export function buildStateConflictError(detail: string) {
  return { message: `state_conflict: ${detail}` };
}

/** 资源缺失 payload。 */
export function buildNotFoundError(target: string) {
  return { message: `not_found: ${target}` };
}

/** 参数非法 payload。 */
export function buildInvalidInputError(detail: string) {
  return { message: `invalid_input: ${detail}` };
}
