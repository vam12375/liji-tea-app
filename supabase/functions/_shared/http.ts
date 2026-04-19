// Edge Function 通用 CORS 响应头：按请求 Origin 与白名单匹配，生产环境禁止通配 *。
//
// 配置来源优先级：
// 1. `Deno.env.get("ALLOWED_ORIGINS")` — Supabase Dashboard → Edge Function Secrets，
//    逗号分隔，例如："https://liji-tea.netlify.app,http://localhost:8081"。
// 2. 未配置时回退到 Web 开发默认值（本机 Expo web 启动端口）。
//
// 注意：React Native 原生端（iOS / Android 正式包、Expo Go）的 fetch 不携带 Origin 头，
// 不触发 CORS，因此无需在此白名单中加任何 `exp+xxx://` / `lijiteaapp://` 等 deep link scheme。
// 特殊值 "*" 仍然兼容（完全放开），但只在显式配置后生效，避免无意放通。

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
];

// 每个 Edge Function 进程内缓存一次白名单，避免每次请求都读环境变量。
let cachedAllowedOrigins: string[] | null = null;

function getAllowedOrigins(): string[] {
  if (cachedAllowedOrigins) {
    return cachedAllowedOrigins;
  }

  const raw = Deno.env.get("ALLOWED_ORIGINS")?.trim();
  if (raw && raw.length > 0) {
    cachedAllowedOrigins = raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } else {
    cachedAllowedOrigins = [...DEFAULT_DEV_ORIGINS];
  }

  return cachedAllowedOrigins;
}

function resolveAllowedOrigin(origin: string | null): string {
  // 非浏览器场景（RN 原生请求）往往没有 Origin 头，此时不注入 Allow-Origin，浏览器也不会感知。
  if (!origin) {
    return "";
  }

  const allowed = getAllowedOrigins();
  if (allowed.includes("*")) {
    return "*";
  }

  return allowed.includes(origin) ? origin : "";
}

/** 为当前请求构造一组 CORS 响应头；未命中白名单时不注入 Allow-Origin，浏览器会自行拦截。 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = resolveAllowedOrigin(req.headers.get("Origin"));
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // 告知缓存按 Origin 区分，避免 CDN 把 A 站点的响应缓存给 B 站点。
    "Vary": "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** 统一处理浏览器预检请求：OPTIONS 直接回 200 + CORS 头；其他方法返回 null 交给业务处理。 */
export function handleCors(req: Request): Response | null {
  if (req.method !== "OPTIONS") {
    return null;
  }

  return new Response("ok", { headers: corsHeadersFor(req) });
}

/** 返回 JSON，并自动附带当前请求的 CORS 头。 */
export function jsonResponse(
  req: Request,
  body: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  for (const [key, value] of Object.entries(corsHeadersFor(req))) {
    headers.set(key, value);
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

/** 返回统一结构的错误响应，便于客户端透传展示。 */
export function errorResponse(
  req: Request,
  message: string,
  status = 400,
  code = "bad_request",
  details?: unknown,
) {
  return jsonResponse(
    req,
    {
      code,
      message,
      details: details ?? null,
    },
    { status },
  );
}

/** 支付宝 notify 需要返回纯文本 success / failure。 */
export function textResponse(
  req: Request,
  body: string,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "text/plain; charset=utf-8");

  for (const [key, value] of Object.entries(corsHeadersFor(req))) {
    headers.set(key, value);
  }

  return new Response(body, {
    ...init,
    headers,
  });
}
