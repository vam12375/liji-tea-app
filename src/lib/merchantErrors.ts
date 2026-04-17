// 商家端 RPC 错误归一化：把 Supabase / Postgres 抛出的原始错误对象
// 拆成 {kind, message} 的结构化形态，页面层只需 catch 一次就能 toast 中文文案。
// 纯函数、无副作用，便于单元测试覆盖所有分支。

export type MerchantErrorKind =
  | "permission_denied"
  | "state_conflict"
  | "invalid_input"
  | "not_found"
  | "network"
  | "unknown";

export interface MerchantError {
  kind: MerchantErrorKind;
  message: string;
  raw?: string;
}

function extractMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const m = (err as { message?: unknown }).message;
  return typeof m === "string" ? m.trim() : "";
}

function extractCode(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const c = (err as { code?: unknown }).code;
  return typeof c === "string" ? c : "";
}

// 把 'state_conflict: order status must be paid' 这类带前缀的消息剥掉前缀只保留正文。
function stripPrefix(value: string, prefix: string) {
  const idx = value.indexOf(prefix);
  return idx >= 0 ? value.slice(idx + prefix.length).trim() : value;
}

export function classifyMerchantError(err: unknown): MerchantError {
  const raw = extractMessage(err);
  const code = extractCode(err);

  if (code === "42501" || /permission_denied/i.test(raw)) {
    return { kind: "permission_denied", message: "无权限执行该操作", raw };
  }
  if (/state_conflict/i.test(raw)) {
    return {
      kind: "state_conflict",
      message: `操作与当前状态冲突：${stripPrefix(raw, "state_conflict:")}`,
      raw,
    };
  }
  if (/not_found/i.test(raw)) {
    return { kind: "not_found", message: "目标对象不存在或已被删除", raw };
  }
  if (/invalid_input/i.test(raw)) {
    return {
      kind: "invalid_input",
      message: `参数不合法：${stripPrefix(raw, "invalid_input:")}`,
      raw,
    };
  }
  if (!raw) {
    return { kind: "unknown", message: "未知错误，请稍后重试" };
  }
  return { kind: "unknown", message: raw, raw };
}

export function isMerchantError(value: unknown): value is MerchantError {
  return Boolean(value) && typeof value === "object" && "kind" in (value as object);
}
