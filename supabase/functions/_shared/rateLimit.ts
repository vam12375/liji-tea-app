// Edge Function 共享限流封装。
//
// 设计取舍（KISS）：
// - 固定窗口计数，底层 SQL 见 migration 202604190003。
// - 基础设施异常（RPC 调用失败）时 fail-open：避免我们自己的 Bug 阻塞合法用户。
// - 每个 Edge Function 用独立 bucket 名（通常与函数名同），便于运营同学按需求单独调整限速。
// - 429 响应统一结构（code: "rate_limited" + retryAfterSec），客户端可据此展示"稍后再试"。

import { errorResponse } from "./http.ts";
import { createServiceClient } from "./supabase.ts";

export interface RateLimitOutcome {
  allowed: boolean;
  retryAfterSec: number;
}

export interface RateLimitOptions {
  bucket: string;
  max: number;
  windowSec: number;
}

/**
 * 原子递增当前 (userId, bucket) 的固定窗口计数，并返回是否允许本次请求。
 *
 * 调用方必须已完成鉴权（user 非 null）；调用前请确保 userId 是 auth.users.id。
 */
export async function enforceRateLimit(
  userId: string,
  options: RateLimitOptions,
): Promise<RateLimitOutcome> {
  const { bucket, max, windowSec } = options;

  const client = createServiceClient();
  const { data, error } = await client.rpc("consume_rate_limit", {
    p_user_id: userId,
    p_bucket: bucket,
    p_max: max,
    p_window_sec: windowSec,
  });

  if (error) {
    // fail-open：基础设施异常不应阻塞合法用户。运营可以通过上报告警发现问题。
    console.warn(
      `[rateLimit] consume_rate_limit RPC 失败（bucket=${bucket}），放行：`,
      error.message,
    );
    return { allowed: true, retryAfterSec: 0 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { allowed: true, retryAfterSec: 0 };
  }

  return {
    allowed: Boolean(row.allowed),
    retryAfterSec: Number(row.retry_after_sec ?? 0),
  };
}

/** 统一 429 响应：code "rate_limited" + details.retryAfterSec + Retry-After 响应头。 */
export function rateLimitedResponse(
  req: Request,
  retryAfterSec: number,
  message = "操作过于频繁，请稍后重试。",
) {
  const response = errorResponse(req, message, 429, "rate_limited", {
    retryAfterSec,
  });
  // HTTP 规范：Retry-After 单位秒，便于通用 HTTP 客户端（浏览器 fetch、curl）也识别。
  response.headers.set("Retry-After", String(Math.max(1, retryAfterSec)));
  return response;
}
