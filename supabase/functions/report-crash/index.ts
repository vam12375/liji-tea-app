// report-crash：客户端崩溃 / captureError 批量上报入口。
// 为什么需要 Edge Function：crash_reports 表 RLS 禁止直接写入，避免伪造 user_id 与刷量；
// 统一入口还能做 batch 上限与字段长度裁剪。
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

import { errorResponse, handleCors, jsonResponse } from "../_shared/http.ts";
import {
  createServiceClient,
  getUserFromRequest,
} from "../_shared/supabase.ts";

// 单条报文字段上限，防止个别 stack 吃掉数据库空间。
const MAX_MESSAGE_LEN = 500;
const MAX_STACK_LEN = 8000;
const MAX_CONTEXT_BYTES = 8000;
const MAX_BATCH_SIZE = 50;

interface IncomingReport {
  scope?: unknown;
  message?: unknown;
  stack?: unknown;
  context?: unknown;
  appVersion?: unknown;
  platform?: unknown;
}

interface ReportRow {
  user_id: string | null;
  scope: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  app_version: string | null;
  platform: string | null;
}

function truncate(value: string, limit: number) {
  return value.length <= limit ? value : value.slice(0, limit);
}

function normalizeString(value: unknown, limit: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return truncate(trimmed, limit);
}

function normalizeContext(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_CONTEXT_BYTES) {
      // 过大的 context 整体丢弃，避免单点拖垮批量写入；保留 message/stack 足够排查。
      return { _truncated: true, _size: serialized.length };
    }
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeReport(raw: IncomingReport, userId: string | null): ReportRow | null {
  const scope = normalizeString(raw.scope, 64);
  const message = normalizeString(raw.message, MAX_MESSAGE_LEN);
  if (!scope || !message) {
    return null;
  }

  return {
    user_id: userId,
    scope,
    message,
    stack: normalizeString(raw.stack, MAX_STACK_LEN),
    context: normalizeContext(raw.context),
    app_version: normalizeString(raw.appVersion, 32),
    platform: normalizeString(raw.platform, 16),
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
    // 允许未登录上报（冷启异常、登录前崩溃），但登录用户写入时绑定 user_id 以便后续自查。
    const user = await getUserFromRequest(req);

    const body = (await req.json().catch(() => null)) as
      | { reports?: IncomingReport[] }
      | null;

    const reports = Array.isArray(body?.reports) ? body!.reports : [];
    if (reports.length === 0) {
      return errorResponse(req, "reports 不能为空。", 400, "empty_reports");
    }

    if (reports.length > MAX_BATCH_SIZE) {
      return errorResponse(
        req,
        `单次上报不得超过 ${MAX_BATCH_SIZE} 条。`,
        400,
        "too_many_reports",
      );
    }

    const rows: ReportRow[] = [];
    let rejected = 0;
    for (const raw of reports) {
      const row = normalizeReport(raw, user?.id ?? null);
      if (row) {
        rows.push(row);
      } else {
        rejected += 1;
      }
    }

    if (rows.length === 0) {
      // 全部被裁剪掉说明客户端负载有问题，直接 400 让客户端看到反馈并排查。
      return errorResponse(
        req,
        "所有上报记录都缺少必要字段。",
        400,
        "all_reports_invalid",
      );
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("crash_reports").insert(rows);

    if (error) {
      return errorResponse(
        req,
        "写入崩溃记录失败。",
        500,
        "crash_insert_failed",
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
      error instanceof Error ? error.message : "崩溃上报处理失败。",
      500,
      "internal_error",
    );
  }
});
