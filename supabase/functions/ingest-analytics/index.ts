// ingest-analytics：客户端行为事件批量上报入口。
// 为什么需要 Edge Function：analytics_events 表禁止客户端直写；统一入口还能做字段长度裁剪与批量上限。
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  enforceAnonymousRateLimit,
  enforceRateLimit,
  rateLimitedResponse,
  resolveClientIpKey,
} from "../_shared/rateLimit.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

// 单条报文字段上限，防止个别 payload 吃掉数据库空间。
const MAX_EVENT_LEN = 64;
const MAX_PROPERTIES_BYTES = 8000;
const MAX_BATCH_SIZE = 100;

interface IncomingEvent {
  event?: unknown;
  properties?: unknown;
  occurredAt?: unknown;
}

interface EventRow {
  user_id: string | null;
  event: string;
  properties: Record<string, unknown> | null;
  occurred_at: string;
}

function truncate(value: string, limit: number) {
  return value.length <= limit ? value : value.slice(0, limit);
}

function normalizeEventName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return truncate(trimmed, MAX_EVENT_LEN);
}

function normalizeProperties(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_PROPERTIES_BYTES) {
      // 过大的 properties 整体丢弃，避免单点拖垮批量写入；事件名仍落库便于计数。
      return { _truncated: true, _size: serialized.length };
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeOccurredAt(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) {
      return date.toISOString();
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
}

function normalizeEvent(raw: IncomingEvent, userId: string | null): EventRow | null {
  const event = normalizeEventName(raw.event);
  const occurredAt = normalizeOccurredAt(raw.occurredAt);
  if (!event || !occurredAt) {
    return null;
  }

  return {
    user_id: userId,
    event,
    properties: normalizeProperties(raw.properties),
    occurred_at: occurredAt,
  };
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  if (req.method !== "POST") {
    return errorResponse(req, "仅支持 POST 请求。", 405, "method_not_allowed");
  }

  try {
    // 允许未登录上报（冷启事件 / 登录前触点），登录用户写入时绑定 user_id 以便后续自查。
    const user = await getUserFromRequest(req);

    // 限流：登录按用户分桶（容量高以容纳批量 flush），匿名按 IP 分桶防刷。
    if (user) {
      const rateLimit = await enforceRateLimit(user.id, {
        bucket: "ingest-analytics",
        max: 60,
        windowSec: 60,
      });
      if (!rateLimit.allowed) {
        return rateLimitedResponse(req, rateLimit.retryAfterSec);
      }
    } else {
      const ipKey = await resolveClientIpKey(req);
      if (ipKey) {
        const rateLimit = await enforceAnonymousRateLimit(ipKey, {
          bucket: "ingest-analytics:anon",
          max: 30,
          windowSec: 60,
        });
        if (!rateLimit.allowed) {
          return rateLimitedResponse(req, rateLimit.retryAfterSec);
        }
      }
    }

    const body = (await req.json().catch(() => null)) as
      | { events?: IncomingEvent[] }
      | null;

    const events = Array.isArray(body?.events) ? body!.events : [];
    if (events.length === 0) {
      return errorResponse(req, "events 不能为空。", 400, "empty_events");
    }

    if (events.length > MAX_BATCH_SIZE) {
      return errorResponse(
        req,
        `单次上报不得超过 ${MAX_BATCH_SIZE} 条。`,
        400,
        "too_many_events",
      );
    }

    const rows: EventRow[] = [];
    let rejected = 0;
    for (const raw of events) {
      const row = normalizeEvent(raw, user?.id ?? null);
      if (row) {
        rows.push(row);
      } else {
        rejected += 1;
      }
    }

    if (rows.length === 0) {
      return errorResponse(
        req,
        "所有事件都缺少必要字段。",
        400,
        "all_events_invalid",
      );
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("analytics_events").insert(rows);

    if (error) {
      return errorResponse(
        req,
        "写入行为事件失败。",
        500,
        "analytics_insert_failed",
        error.message,
      );
    }

    return jsonResponse(req, {
      accepted: rows.length,
      rejected,
    });
  } catch (error) {
    return errorResponse(
      req,
      error instanceof Error ? error.message : "行为事件上报处理失败。",
      500,
      "internal_error",
    );
  }
});
