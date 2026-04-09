import type { FunctionInvokeOptions } from '@supabase/supabase-js';

import { logDebug, logWarn } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type EdgeFunctionAuthMode = 'auto' | 'public' | 'session';
export type SupabaseFunctionErrorKind =
  | 'auth'
  | 'business'
  | 'network'
  | 'http'
  | 'unknown';

const fallbackFunctionJwt =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
const functionGatewayApiKey = fallbackFunctionJwt;

interface AccessTokenSnapshot {
  sessionExists: boolean;
  accessToken: string | null;
}

export interface InvokeSupabaseFunctionOptions extends FunctionInvokeOptions {
authMode?: EdgeFunctionAuthMode;
}

export interface NormalizedFunctionError {
  kind: SupabaseFunctionErrorKind;
  message: string;
  status: number | null;
  code?: string | null;
responseBody?: unknown;
}

export class SupabaseFunctionError extends Error {
  kind: SupabaseFunctionErrorKind;
  status: number | null;
  code: string | null;
  responseBody?: unknown;
  cause?: unknown;

  constructor(params: {
message: string;
    kind: SupabaseFunctionErrorKind;
    status?: number | null;
    code?: string | null;
    responseBody?: unknown;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'SupabaseFunctionError';
    this.kind = params.kind;
    this.status = params.status ?? null;
    this.code = params.code ?? null;
    this.responseBody = params.responseBody;
    this.cause = params.cause;
  }
}

export interface InvokeSupabaseFunctionStrictOptions<T>
  extends InvokeSupabaseFunctionOptions {
  fallbackMessage: string;
  validate?: (data: T | null) => boolean;
  invalidDataMessage?: string;
}

async function getCurrentAccessTokenSnapshot(): Promise<AccessTokenSnapshot> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token?.trim() || null;

  logDebug('supabase-function', '读取当前会话令牌快照', {
    hasSession: !!session,
    hasAccessToken: !!accessToken,
    tokenLength: accessToken?.length ?? 0,
  });

  return {
    sessionExists: !!session,
    accessToken,
  };
}

// 所有 Edge Function 调用统一从这里构建请求头，保证鉴权策略一致。
export async function buildEdgeFunctionHeaders(
  init?: HeadersInit,
  authMode: EdgeFunctionAuthMode = 'auto',
): Promise<Record<string, string>> {
  const headers = new Headers(init);

  headers.delete('authorization');
  headers.delete('Authorization');

  if (authMode === 'public' && fallbackFunctionJwt) {
    headers.set('Authorization', `Bearer ${fallbackFunctionJwt}`);
  }

  if (functionGatewayApiKey) {
    headers.delete('apikey');
    headers.set('apikey', functionGatewayApiKey);
  }

  return Object.fromEntries(headers.entries());
}

function getErrorContextResponse(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    error.context instanceof Response
  ){
    return error.context;
  }

  return null;
}

// 尽量把服务端返回体读出来，后续错误归一化时可以给出更可排查的上下文。
async function readResponseBody(response: Response) {
  try {
    return await response.clone().json();
  } catch {
    try {
      const text =await response.clone().text();
      return text.trim() || null;
    } catch {
      return null;
    }
  }
}

function getMessageFromBody(body: unknown) {
  if (!body) {
    return null;
  }

  if (typeof body === 'string') {
    return body.trim() || null;
  }

  if (typeof body === 'object') {
    const record = body as Record<string, unknown>;

    if (typeof record.message === 'string' && record.message.trim()) {
return record.message.trim();
    }

    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim();
    }
  }

  return null;
}

function classifyFunctionError(params: {
  status: number | null;
body: unknown;
  fallbackMessage: string;
  rawError: unknown;
}): NormalizedFunctionError {
  const { status, body, fallbackMessage, rawError } = params;
  const parsedMessage = getMessageFromBody(body);
  const baseMessage =
parsedMessage ||
    (rawError instanceof Error ? rawError.message : null) ||
    fallbackMessage;

  const code =
    body &&
    typeof body === 'object' &&
    'code' in body &&
    typeof body.code === 'string'
      ? body.code
      : null;

  if (status === 401 || status === 403) {
    return {
      kind: 'auth',
      message: parsedMessage || '登录状态已失效，请重新登录。',
      status,
      code,
      responseBody: body,
    };
  }

  if (status !== null && status >= 400 && status < 500) {
    return {
      kind: 'business',
      message: baseMessage,
      status,
      code,
      responseBody: body,
    };
  }

  if (status !== null && status >= 500) {
    return {
      kind: 'http',
      message: baseMessage,
      status,
      code,
responseBody: body,
    };
  }

  if (rawError instanceof Error) {
    const lowerMessage = rawError.message.toLowerCase();

    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('fetch') ||
lowerMessage.includes('timeout')
    ) {
      return {
        kind: 'network',
        message: baseMessage,
        status,
        code,
        responseBody: body,
      };
    }
  }

  return {
    kind: 'unknown',
    message: baseMessage,
    status,
    code,
    responseBody: body,
  };
}

export async function normalizeFunctionError(
  error: unknown,
  fallbackMessage: string,
): Promise<NormalizedFunctionError> {
const response = getErrorContextResponse(error);
  const status = response?.status ?? null;
  const body = response ? await readResponseBody(response) : null;

  return classifyFunctionError({
    status,
    body,
fallbackMessage,
    rawError: error,
  });
}

export async function readEdgeErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  const normalized = await normalizeFunctionError(error, fallbackMessage);
return normalized.message;
}

async function shouldRetryWithSessionRefresh(
  error: unknown,
  authMode: EdgeFunctionAuthMode,
) {
  if (authMode === 'public') {
    return false;
  }

  const normalized = await normalizeFunctionError(
    error,
    '调用 Edge Function失败。',
  );

  if (normalized.status !== 401) {
    return false;
  }

  const message = normalized.message.toLowerCase();
  return message.includes('invalid jwt') || message.includes('jwt expired');
}

async function refreshEdgeFunctionSession() {
  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    logWarn('supabase-function', '刷新 Edge Function 会话失败', {
      message: error.message,
    });
    return false;
  }

  return Boolean(data.session?.access_token?.trim());
}

export async function invokeSupabaseFunction<T>(
  functionName: string,
  options: InvokeSupabaseFunctionOptions = {},
) {
  const { authMode = 'auto', ...invokeOptions } = options;

  const runInvoke = async () => {
    const tokenSnapshot =
      authMode === 'public'
        ? { sessionExists: false, accessToken: null }
        : await getCurrentAccessTokenSnapshot();

    if (authMode === 'session' && !tokenSnapshot.accessToken) {
      throw new SupabaseFunctionError({
        kind: 'auth',
        message: '未获取到有效的登录凭证，请重新登录。',
        status: 401,
      });
    }

const resolvedAuthMode: EdgeFunctionAuthMode =
      authMode === 'auto'
        ? tokenSnapshot.accessToken
          ? 'session'
          : 'public'
        : authMode;

    const headers = await buildEdgeFunctionHeaders(
      invokeOptions.headers,
      resolvedAuthMode === 'session' ? 'auto' : resolvedAuthMode,
    );

    logDebug('supabase-function', '调用 Edge Function', {
      functionName,
      authMode,
      resolvedAuthMode,
      hasSession: tokenSnapshot.sessionExists,
hasSessionAccessToken: !!tokenSnapshot.accessToken,
      hasAuthorizationHeader: Boolean(
        headers.authorization || headers.Authorization,
      ),
      hasApiKeyHeader: Boolean(headers.apikey),
    });

    return supabase.functions.invoke<T>(functionName, {
      ...invokeOptions,
      headers,
    });
  };

  const result = await runInvoke();

  if (
    !result.error ||
    !(await shouldRetryWithSessionRefresh(result.error, authMode))
  ) {
    return result;
  }

const refreshed = await refreshEdgeFunctionSession();
  if (!refreshed) {
    return result;
  }

  return runInvoke();
}

export async function invokeSupabaseFunctionStrict<T>(
  functionName: string,
  options: InvokeSupabaseFunctionStrictOptions<T>,
):Promise<T> {
  const {
    fallbackMessage,
    validate,
    invalidDataMessage = '服务端返回的数据格式不正确。',
    ...invokeOptions
  } = options;

  const { data, error } = await invokeSupabaseFunction<T>(
    functionName,
    invokeOptions,
  );

  if (error) {
    const normalized = await normalizeFunctionError(error, fallbackMessage);
    throw new SupabaseFunctionError({
      message: normalized.message,
      kind: normalized.kind,
      status: normalized.status,
      code: normalized.code,
      responseBody: normalized.responseBody,
      cause: error,
    });
  }

  const payload = data ?? null;
if (validate && !validate(payload)) {
    throw new SupabaseFunctionError({
      message: invalidDataMessage,
      kind: 'unknown',
      responseBody: payload,
    });
  }

  return payload as T;
}
