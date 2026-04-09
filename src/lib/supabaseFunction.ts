import type { FunctionInvokeOptions } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

const fallbackFunctionJwt = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const functionGatewayApiKey = fallbackFunctionJwt;

/** Edge Function 网关要求 apikey始终存在；session/auto 模式不显式写 Authorization，避免与 SDK 默认头冲突。 */
async function getCurrentAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

const accessToken = session?.access_token?.trim() || null;

  if (__DEV__) {
    console.log("[getCurrentAccessToken]", {
      hasSession: !!session,
      hasAccessToken: !!accessToken,
      tokenLength: accessToken?.length|| 0,
    });
  }

  return accessToken;
}

export async function buildEdgeFunctionHeaders(
  init?: HeadersInit,
  authMode: "auto" | "public" | "session" = "auto",
): Promise<Record<string, string>> {
  const headers = new Headers(init);

  if (authMode === "public" && fallbackFunctionJwt) {
    headers.delete("authorization");
headers.set("Authorization", `Bearer ${fallbackFunctionJwt}`);
  } else {
    headers.delete("authorization");
    headers.delete("Authorization");
  }

  if (functionGatewayApiKey) {
headers.delete("apikey");
    headers.set("apikey", functionGatewayApiKey);
  }

  return Object.fromEntries(headers.entries());
}

interface InvokeSupabaseFunctionOptions extends FunctionInvokeOptions {
  authMode?: "auto" | "public" | "session";
}

function getErrorContextResponse(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
"context" in error &&
    error.context instanceof Response
  ) {
    return error.context;
  }

  return null;
}

async function readEdgeErrorMessage(error: unknown) {
  const response = getErrorContextResponse(error);
  if (!response) {
    return error instanceof Error ? error.message : null;
  }

  const clonedResponse= response.clone();

  try {
    const json = (await clonedResponse.json()) as { message?: string };
    if (json?.message) {
      return json.message;
    }
  } catch {
    //ignore
  }

  try {
    const text = (await clonedResponse.text()).trim();
    return text || null;
  } catch {
    // ignore
  }

  return error instanceof Error ? error.message : null;
}

async function shouldRetryWithSessionRefresh(error: unknown) {
  const response = getErrorContextResponse(error);
  if (!response || response.status !== 401) {
    return false;
  }

  const message = (await readEdgeErrorMessage(error))?.toLowerCase() ?? "";
  return message.includes("invalid jwt") || message.includes("jwt");
}

async function refreshEdgeFunctionSession() {
  const { data, error } =await supabase.auth.refreshSession();

  if (error) {
    return false;
  }

  return Boolean(data.session?.access_token?.trim());
}

export async function invokeSupabaseFunction<T>(
  functionName: string,
  options: InvokeSupabaseFunctionOptions = {},
) {
  const { authMode = "auto", ...invokeOptions } = options;

  const runInvoke = async () => {
const accessToken = authMode === "public" ? null : await getCurrentAccessToken();
    const headers = await buildEdgeFunctionHeaders(invokeOptions.headers, authMode);

    if (authMode === "session" && !accessToken) {
      throw new Error("未获取到有效的登录凭证，请重新登录。");
    }

    if (__DEV__) {
const authHeader = headers.authorization || headers.Authorization || "";
      const apikeyHeader = headers.apikey ||"";
      console.log("[supabaseFunction] 调用函数:", functionName, {
        authMode,
        hasSessionAccessToken: !!accessToken,
        authPrefix: authHeader.substring(0, 30),
        authSuffix: authHeader.substring(Math.max(0, authHeader.length - 20)),
        apikeyPrefix: apikeyHeader.substring(0, 30),
        apikeySuffix: apikeyHeader.substring(Math.max(0, apikeyHeader.length - 20)),
      });
    }

    return supabase.functions.invoke<T>(functionName, {
      ...invokeOptions,
headers,
    });
  };

  const result = await runInvoke();

  if (
    !result.error ||
    authMode === "public" ||
    !(await shouldRetryWithSessionRefresh(result.error))
  ) {
    return result;
  }

  const refreshed = await refreshEdgeFunctionSession();
  if (!refreshed) {
    return result;
  }

  return runInvoke();
}
