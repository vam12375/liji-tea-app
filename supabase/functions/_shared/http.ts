/** Edge Function 通用 CORS 响应头。 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** 统一处理浏览器预检请求。 */
export function handleCors(req: Request) {
  if (req.method !== "OPTIONS") {
    return null;
  }

  return new Response("ok", { headers: corsHeaders });
}

/** 返回 JSON，并自动附带 CORS 头。 */
export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

/** 返回统一结构的错误响应，便于客户端透传展示。 */
export function errorResponse(
  message: string,
  status = 400,
  code = "bad_request",
  details?: unknown
) {
  return jsonResponse(
    {
      code,
      message,
      details: details ?? null,
    },
    { status }
  );
}

/** 支付宝 notify 需要返回纯文本 success / failure。 */
export function textResponse(body: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "text/plain; charset=utf-8");

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(body, {
    ...init,
    headers,
  });
}
