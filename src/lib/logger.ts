type LoggerContext = Record<string, unknown> | undefined;
const isDevelopment =
  typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

/** 统一拼装日志前缀和上下文字段，避免每处手写 console 参数。 */
function formatPayload(scope: string, message: string, context?: LoggerContext) {
  if (!context || Object.keys(context).length === 0) {
    return [`[${scope}] ${message}`] as const;
  }

  return [`[${scope}] ${message}`, context] as const;
}

/** info 级日志默认只在开发态输出，避免线上噪音。 */
export function logInfo(scope: string, message: string, context?: LoggerContext) {
  if (!isDevelopment) {
    return;
  }

  console.info(...formatPayload(scope, message, context));
}

/** warn 级日志默认持续输出，方便排查异常数据。 */
export function logWarn(scope: string, message: string, context?: LoggerContext) {
  console.warn(...formatPayload(scope, message, context));
}

/** captureError 作为后续对接 Sentry/PostHog 前的统一占位层。 */
export function captureError(
  error: unknown,
  context?: LoggerContext & { scope?: string; message?: string },
) {
  const scope = context?.scope ?? "error";
  const message =
    context?.message ??
    (error instanceof Error ? error.message : "发生未识别异常。");

  const detail =
    error instanceof Error
      ? { name: error.name, stack: error.stack, ...context }
      : context;

  console.error(...formatPayload(scope, message, detail));
}
