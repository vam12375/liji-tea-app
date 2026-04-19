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

/**
 * 匿名维度固定窗口限流：底层 SQL 见 migration 202604190005。
 *
 * 调用方应把 bucketKey 做一次不可逆 hash（例如 IP / 手机号 SHA-256 前 16 位），
 * 避免把明文 PII 写入数据库；多维度（phone + ip）可用前缀区分 bucket 名。
 *
 * 与登录态 `enforceRateLimit` 分离的原因：
 * - 登录表 rate_limit_buckets.user_id 外键到 auth.users(id)，不能容纳匿名请求。
 * - 单独一张表 + 一个 RPC 更简单，也避免在同一表里混用"有外键 vs 无外键"两种键。
 */
export async function enforceAnonymousRateLimit(
  bucketKey: string,
  options: RateLimitOptions,
): Promise<RateLimitOutcome> {
  const { bucket, max, windowSec } = options;

  const trimmedKey = bucketKey?.trim();
  if (!trimmedKey) {
    // 无法识别调用来源时，保守放行：匿名限流不应阻塞无法提取 key 的合法请求。
    // 调用方可在日志里上报该情况，便于后续决定是否降级为"全量限流"。
    console.warn(
      `[rateLimit] enforceAnonymousRateLimit 缺失 bucketKey（bucket=${bucket}），放行。`,
    );
    return { allowed: true, retryAfterSec: 0 };
  }

  const client = createServiceClient();
  const { data, error } = await client.rpc("consume_anon_rate_limit", {
    p_bucket_key: trimmedKey,
    p_bucket: bucket,
    p_max: max,
    p_window_sec: windowSec,
  });

  if (error) {
    console.warn(
      `[rateLimit] consume_anon_rate_limit RPC 失败（bucket=${bucket}），放行：`,
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

/**
 * 提取匿名请求的调用端 IP（Supabase Edge 运行在 CDN 后，需要看转发头）。
 *
 * 返回已 hash 的短 key（SHA-256 前 16 位），避免明文 IP 落库。
 * 无法获取时返回 null，调用方可放行或降级。
 */
export async function resolveClientIpKey(req: Request): Promise<string | null> {
  // x-forwarded-for 可能是逗号分隔的 IP 链，取第一个（客户端真实 IP）。
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const fly = req.headers.get("fly-client-ip"); // Supabase Edge 曾用 Fly.io 网络层。
  const raw =
    (forwarded && forwarded.split(",")[0]?.trim()) ||
    (realIp && realIp.trim()) ||
    (fly && fly.trim()) ||
    "";

  if (!raw) {
    return null;
  }

  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  // 前 16 位（64 bit）已足够区分合理并发规模，保持 bucket_key 简短。
  return hex.slice(0, 16);
}
