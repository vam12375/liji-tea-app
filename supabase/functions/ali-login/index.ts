// ali-login/index.ts - 阿里云一键登录 Token 验证 Edge Function
//
// 职责：
// 1. 接收前端传来的 Token
// 2. 调用阿里云 API 验证 Token，获取真实手机号
// 3. 在 Supabase 中查找/创建关联用户
// 4. 返回 Supabase Session 供前端登录
//
// 遵循 KISS：只做 Token 验证和用户关联，不包含业务逻辑
//
// 依赖环境变量（需在 Supabase Dashboard 配置）：
// - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// - ALI_ACCESS_KEY_ID / ALI_ACCESS_KEY_SECRET / ALI_APP_KEY

import { createServiceClient, getRequiredEnv } from "../_shared/supabase.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/http.ts";

interface AliLoginRequest { token: string; }

interface AliVerifyResponse {
  Code: string;
  Message?: string;
  Mobile?: string;
}

// 阿里云 API 签名生成（HMAC-SHA1）
async function generateAliSignature(secret: string, stringToSign: string): Promise<string> {
  const key = new TextEncoder().encode(secret + "&");
  const msg = new TextEncoder().encode(stringToSign);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msg);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// 调用阿里云验证 API 获取手机号
async function verifyAliToken(token: string): Promise<string> {
  const accessKeyId = getRequiredEnv("ALI_ACCESS_KEY_ID");
  const accessKeySecret = getRequiredEnv("ALI_ACCESS_KEY_SECRET");
  const appKey = getRequiredEnv("ALI_APP_KEY");
  const timestamp = new Date().toISOString();

  const params = new URLSearchParams({
    Format: "JSON", Version: "2017-05-25", SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0", SignatureNonce: crypto.randomUUID(),
    AccessKeyId: accessKeyId, Timestamp: timestamp,
    Action: "GetMobile", AppKey: appKey, Token: token,
  });

  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
    .join("&");

  const stringToSign = "GET&" + encodeURIComponent("/") + "&" + encodeURIComponent(sortedParams);
  const signature = await generateAliSignature(accessKeySecret, stringToSign);
  const verifyUrl = "https://dypnsapi.aliyuncs.com/?" + params.toString() + "&Signature=" + encodeURIComponent(signature);

  console.log("[ali-login] 调用阿里云验证 API");
  const response = await fetch(verifyUrl, { method: "GET", headers: { "Content-Type": "application/json" } });
  if (!response.ok) throw new Error("阿里云 API 请求失败: " + response.status);

  const result: AliVerifyResponse = await response.json();
  if (result.Code !== "OK") throw new Error(result.Message || "验证失败: " + result.Code);
  if (!result.Mobile) throw new Error("未获取到手机号");

  console.log("[ali-login] 验证成功，手机号: " + result.Mobile.substring(0, 3) + "****" + result.Mobile.substring(7));
  return result.Mobile;
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== "POST") return errorResponse("仅支持 POST 方法", 405, "method_not_allowed");

  try {
    // 步骤1：解析请求体
    let body: AliLoginRequest;
    try { body = await req.json(); } catch { return errorResponse("请求体格式错误", 400, "invalid_body"); }
    const { token } = body;
    if (!token || typeof token !== "string" || token.trim() === "") {
      return errorResponse("Token 不能为空", 400, "missing_token");
    }
    console.log("[ali-login] 收到登录请求");

    // 步骤2：验证 Token
    let phoneNumber: string;
    try {
      phoneNumber = await verifyAliToken(token.trim());
    } catch (err: any) {
      // 调试模式：Mock Token 使用假手机号（生产环境应移除）
      if (token.startsWith("MOCK_TOKEN") || token.startsWith("PLACEHOLDER")) {
        console.log("[ali-login] Mock Token，跳过验证");
        phoneNumber = "13800138000";
      } else {
        return errorResponse(err?.message || "Token 验证失败", 401, "verify_failed");
      }
    }

    // 步骤3：查找/创建用户
    const supabase = createServiceClient();
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles").select("user_id").eq("phone", phoneNumber).maybeSingle();

    if (profileError) return errorResponse("查询用户失败", 500, "db_error");

    let userId: string;
    if (existingProfile) {
      userId = existingProfile.user_id;
      console.log("[ali-login] 已有用户: " + userId);
    } else {
      console.log("[ali-login] 创建新用户: " + phoneNumber);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        phone: phoneNumber, phone_confirmed_at: new Date().toISOString(),
      });
      if (createError) return errorResponse("创建用户失败: " + createError.message, 500, "create_user_error");
      userId = newUser.user!.id;
    }

    // 步骤4：生成 Session
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink", email: "+" + phoneNumber + "@phone-auth.lijitea.com",
    });

    if (sessionError) {
      return jsonResponse({ session: null, userId, warning: "Session 生成失败，用户已关联成功" });
    }

    const accessToken = sessionData.properties?.href?.split("token=")[1]?.split("&")[0] || "";
    console.log("[ali-login] 登录成功");
    return jsonResponse({
      session: {
        access_token: accessToken, refresh_token: "",
        expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: userId, phone: phoneNumber },
      },
    });

  } catch (err: any) {
    console.error("[ali-login] 异常:", err);
    return errorResponse("服务器内部错误: " + (err?.message || "未知错误"), 500, "internal_error");
  }
});
