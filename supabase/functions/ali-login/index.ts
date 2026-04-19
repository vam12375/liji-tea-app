// ali-login/index.ts - 阿里云融合认证 Edge Function
//
// 职责：
// 1. GET  /ali-login?action=getAuthToken  — 获取融合认证鉴权 Token（供客户端 SDK 初始化）
// 2. POST /ali-login                      — 验证 verifyToken，获取手机号，查找/创建用户，返回 Session
//
// 依赖环境变量（需在 Supabase Dashboard 配置）：
// - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// - ALI_ACCESS_KEY_ID / ALI_ACCESS_KEY_SECRET
// - ALI_FUSION_SCHEME_CODE  （融合认证方案 Code，在阿里云控制台「融合认证」应用下获取）

import { createClient } from "jsr:@supabase/supabase-js@2";

import { createServiceClient, getRequiredEnv } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/http.ts";

// ────────────────────────────────────────────────────────────
// 阿里云签名工具
// ────────────────────────────────────────────────────────────

async function generateAliSignature(secret: string, stringToSign: string): Promise<string> {
  const key = new TextEncoder().encode(secret + "&");
  const msg = new TextEncoder().encode(stringToSign);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// 阿里云规范的 percent-encode（RFC 3986，空格=%20，不是+）
function pct(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

async function callAliApi(
  action: string,
  extra: Record<string, string>
): Promise<Record<string, unknown>> {
  const accessKeyId = getRequiredEnv("ALI_ACCESS_KEY_ID");
  const accessKeySecret = getRequiredEnv("ALI_ACCESS_KEY_SECRET");

  // 1. 构造参数对象（不含 Signature）
  const rawParams: Record<string, string> = {
    Format: "JSON",
    Version: "2017-05-25",
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: crypto.randomUUID(),
    AccessKeyId: accessKeyId,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Action: action,
    ...extra,
  };

  // 2. 按字典序排序，构造规范化查询字符串
  const canonicalQuery = Object.keys(rawParams)
    .sort()
    .map((k) => pct(k) + "=" + pct(rawParams[k]))
    .join("&");

  // 3. 构造待签字符串
  const stringToSign = "GET&" + pct("/") + "&" + pct(canonicalQuery);

  // 4. 签名
  const signature = await generateAliSignature(accessKeySecret, stringToSign);

  // 5. 拼接最终 URL（直接附加已编码的 canonicalQuery + Signature）
  const url = "https://dypnsapi.aliyuncs.com/?" + canonicalQuery + "&Signature=" + pct(signature);

  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) {
    const msg = body["Message"] || body["Code"] || response.status;
    throw new Error("阿里云 API 请求失败: " + msg);
  }
  return body;
}

// ────────────────────────────────────────────────────────────
// GET ?action=getAuthToken — 获取融合认证鉴权 Token
// 客户端 SDK 初始化时需要此 Token
// ────────────────────────────────────────────────────────────

async function getFusionAuthToken(): Promise<string> {
  const schemeCode = getRequiredEnv("ALI_FUSION_SCHEME_CODE");
  const result = await callAliApi("GetFusionAuthToken", {
    SchemeCode: schemeCode,
    Platform: "Android",
    PackageName: "com.liji.teaapp",
    PackageSign: "20f46148b72d8e5e5ca23d37a4f41490",
    DurationSeconds: "3600",
  });

  if (result["Code"] !== "OK") {
    throw new Error((result["Message"] as string) || "获取鉴权 Token 失败: " + result["Code"]);
  }

  const authToken = result["Model"] as string | undefined;
  if (!authToken) {
    throw new Error("鉴权 Token 字段缺失");
  }

  return authToken;
}

// ────────────────────────────────────────────────────────────
// POST — 验证 verifyToken，获取手机号
// ────────────────────────────────────────────────────────────

async function verifyFusionToken(verifyToken: string): Promise<string> {
  const schemeCode = getRequiredEnv("ALI_FUSION_SCHEME_CODE");
  const result = await callAliApi("VerifyWithFusionAuthToken", {
    SchemeCode: schemeCode,
    VerifyToken: verifyToken,
  });

  if (result["Code"] !== "OK") {
    throw new Error((result["Message"] as string) || "verifyToken 验证失败: " + result["Code"]);
  }

  const phoneNumber = result["PhoneNumber"] as string | undefined;
  if (!phoneNumber) throw new Error("未获取到手机号");

  return phoneNumber;
}

// ────────────────────────────────────────────────────────────
// 查找或创建用户，生成 Session
// ────────────────────────────────────────────────────────────

function createAnonAuthClient() {
  return createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function buildOneClickPassword(phoneNumber: string) {
  const raw = `${getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")}:${phoneNumber}:ali-one-click`;
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  return `LiJi!${hash.slice(0, 24)}a1`;
}

async function findOrCreateUserSession(phoneNumber: string) {
  const supabase = createServiceClient();
  const authClient = createAnonAuthClient();
  const password = await buildOneClickPassword(phoneNumber);

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("phone", phoneNumber)
    .maybeSingle();

  if (profileError) throw new Error("查询用户失败: " + profileError.message);

  let userId: string;
  if (existingProfile) {
    userId = existingProfile.user_id;

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      phone: phoneNumber,
      password,
      phone_confirm: true,
    });

    if (updateError) {
      throw new Error("更新用户失败: " + updateError.message);
    }
  } else {
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      phone: phoneNumber,
      password,
      phone_confirm: true,
    });

    if (createError || !newUser.user) {
      throw new Error("创建用户失败: " + (createError?.message ?? "用户数据缺失"));
    }

    userId = newUser.user.id;
  }

  const { data: sessionData, error: sessionError } =
    await authClient.auth.signInWithPassword({ phone: phoneNumber, password });

  if (sessionError || !sessionData?.session) {
    throw new Error("Session 生成失败: " + sessionError?.message);
  }

  return sessionData.session;
}

// ────────────────────────────────────────────────────────────
// 主入口
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    // GET ?action=getAuthToken — 返回融合认证鉴权 Token 给客户端
    if (req.method === "GET") {
      const url = new URL(req.url);
      if (url.searchParams.get("action") !== "getAuthToken") {
        return errorResponse(req, "不支持的 GET 请求", 400, "bad_request");
      }
      const authToken = await getFusionAuthToken();
      return jsonResponse(req, { authToken });
    }

    // POST — 验证 verifyToken，登录
    if (req.method === "POST") {
      let body: { verifyToken?: string };
      try { body = await req.json(); } catch { return errorResponse(req, "请求体格式错误", 400, "invalid_body"); }

      const { verifyToken } = body;
      if (!verifyToken || typeof verifyToken !== "string" || verifyToken.trim() === "") {
        return errorResponse(req, "verifyToken 不能为空", 400, "missing_verify_token");
      }

      let phoneNumber: string;
      try {
        phoneNumber = await verifyFusionToken(verifyToken.trim());
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "verifyToken 验证失败";
        return errorResponse(req, msg, 401, "verify_failed");
      }

      const session = await findOrCreateUserSession(phoneNumber);
      return jsonResponse(req, { session });
    }

    return errorResponse(req, "仅支持 GET 和 POST 方法", 405, "method_not_allowed");

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "未知错误";
    console.error("[ali-login] 异常:", msg);
    return errorResponse(req, "服务器内部错误: " + msg, 500, "internal_error");
  }
});
