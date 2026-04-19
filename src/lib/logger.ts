type Primitive = string | number | boolean | null | undefined;
export type LoggerValue =Primitive | LoggerValue[] | Record<string, unknown>;
export type LoggerContext = Record<string, unknown> | undefined;

/**
 * 外部 transport 注册接口：保持 logger 本身无运行时外部依赖，
 * 便于在纯 Node 测试环境里使用。
 */
export interface CaptureReport {
  scope: string;
  message: string;
  stack?: string;
  context?: Record<string, LoggerValue> | undefined;
}
export type CaptureHandler = (report: CaptureReport) => void;

let captureHandler: CaptureHandler | null = null;

/** 由入口模块（如 _layout.tsx）调用，挂接远端上报器。 */
export function registerCaptureHandler(handler: CaptureHandler | null): void {
  captureHandler = handler;
}

const isDevelopment =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";

const REDACTED_KEYS = [
  "authorization",
  "apikey",
  "access_token",
  "refresh_token",
  "token",
  "jwt",
  "phone",
  "mobile",
  "verifytoken",
  "verify_token",
  "password",
  "secret",
  "privatekey",
  "private_key",
] as const;

// 按 key 名做脱敏匹配，避免日志里泄漏 token、手机号和密钥。
function shouldRedactKey(key: string) {
  const normalizedKey = key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return REDACTED_KEYS.some((item) => normalizedKey.includes(item));
}

function redactString(value: string) {
  if (value.length <= 8) {
    return "[REDACTED]";
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 递归清洗上下文对象，保证业务日志仍可读，同时敏感字段被掩码。
function redactUnknown(key: string, value: unknown): LoggerValue {
  if (shouldRedactKey(key)) {
    if (typeof value === "string") {
      return redactString(value);
    }

    return "[REDACTED]";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>redactUnknown(key, item));
  }

  if (isPlainObject(value)) {
    return redactContext(value) ?? {};
  }

  return String(value);
}

export function redactContext(
  context?: Record<string, unknown>,
): Record<string, LoggerValue> | undefined {
  if (!context) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key,redactUnknown(key, value)]),
  );
}

function formatPayload(scope: string, message: string, context?: LoggerContext) {
  const safeContext = redactContext(context);

  if (!safeContext|| Object.keys(safeContext).length === 0) {
    return [`[${scope}] ${message}`] as const;
  }

  return [`[${scope}] ${message}`, safeContext] as const;
}

export function logDebug(scope: string, message: string, context?:LoggerContext) {
  if (!isDevelopment) {
    return;
  }

  console.debug(...formatPayload(scope, message, context));
}

export function logInfo(scope: string, message: string, context?: LoggerContext) {
  if (!isDevelopment) {
    return;
  }

  console.info(...formatPayload(scope, message, context));
}

export function logWarn(scope: string, message: string, context?: LoggerContext) {
  console.warn(...formatPayload(scope, message, context));
}

export function logError(scope: string, message: string, context?: LoggerContext) {
  console.error(...formatPayload(scope, message, context));
}

export function captureError(
  error: unknown,
  context?: LoggerContext & { scope?: string; message?: string },
) {
const scope = typeof context?.scope === "string" ? context.scope : "error";
  const message =
    typeof context?.message === "string"
      ? context.message
      : error instanceof Error
        ? error.message
        : "发生未识别异常。";

const detail =
    error instanceof Error
      ? {
          name: error.name,
          stack: error.stack,
          ...redactContext(context),
        }
      : redactContext(context);

  console.error(...formatPayload(scope, message, detail));

  // 如已挂接远端 transport（crashReporter），透传一份；handler 内部失败绝不抛回。
  if (captureHandler) {
    try {
      captureHandler({
        scope,
        message,
        stack: error instanceof Error ? error.stack : undefined,
        context: redactContext(context),
      });
    } catch {
      // 防御式兜底：transport 自身异常不能拖垮业务日志路径。
    }
  }
}
