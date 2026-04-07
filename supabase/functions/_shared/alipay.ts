/** 支付宝 RSA2 签名算法配置。 */
const SIGN_ALGORITHM: RsaHashedImportParams = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
};

interface BuildAlipayOrderStringOptions {
  appId: string;
  privateKeyPem: string;
  notifyUrl: string;
  subject: string;
  outTradeNo: string;
  totalAmount: string;
  body?: string;
  sellerId?: string;
  timeoutExpress?: string;
  timestamp?: Date;
}

interface AlipayOpenApiOptions {
  gatewayUrl: string;
  appId: string;
  privateKeyPem: string;
  method: string;
  bizContent: Record<string, unknown>;
  sellerId?: string;
  timestamp?: Date;
}

export interface AlipayTradeCloseResult {
  success: boolean;
  code: string | null;
  subCode: string | null;
  message: string;
  rawResponse: Record<string, unknown>;
}

export const ALIPAY_TIMEOUT_EXPRESS = "10m";

/** 去掉 PEM 包裹头尾和空白，转换为可导入的纯 base64 内容。 */
function normalizePem(pem: string) {
  return pem
    // 去掉外层引号（env 中可能带有多余引号）
    .replace(/^["']+|["']+$/g, "")
    // 去掉 PEM 头尾
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    // 处理各种换行符变体：字面量 \\n、字面量 \n、真实换行
    .replace(/\\\\n/g, "")
    .replace(/\\n/g, "")
    .replace(/\r?\n/g, "")
    // 清除所有空白
    .replace(/\s+/g, "");
}

/** base64 查表解码，完全不依赖 atob，兼容 Deno 严格模式。 */
const B64_LOOKUP = new Uint8Array(128);
{
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < chars.length; i++) {
    B64_LOOKUP[chars.charCodeAt(i)] = i;
  }
}

function base64ToBytes(raw: string) {
  // 仅保留合法 base64 字符，自动跳过填充和杂质
  const base64 = raw.replace(/[^A-Za-z0-9+/]/g, "");
  const len = base64.length;
  const byteLen = (len * 3) >>> 2;
  const bytes = new Uint8Array(byteLen);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64_LOOKUP[base64.charCodeAt(i)];
    const b = i + 1 < len ? B64_LOOKUP[base64.charCodeAt(i + 1)] : 0;
    const c = i + 2 < len ? B64_LOOKUP[base64.charCodeAt(i + 2)] : 0;
    const d = i + 3 < len ? B64_LOOKUP[base64.charCodeAt(i + 3)] : 0;

    if (p < byteLen) bytes[p++] = (a << 2) | (b >> 4);
    if (p < byteLen) bytes[p++] = ((b & 0xf) << 4) | (c >> 2);
    if (p < byteLen) bytes[p++] = ((c & 0x3) << 6) | d;
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

/** 生成支付宝要求的待签名串，按 key 排序且不做 URL 编码。 */
function createCanonicalQuery(params: Record<string, string | undefined>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value as string}`)
    .join("&");
}

/** 生成最终给客户端使用的 orderString，字段需要做 URL 编码。 */
function createEncodedQuery(params: Record<string, string | undefined>) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`
    )
    .join("&");
}

function formatTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

/**
 * 解析 DER 结构外层 SEQUENCE 的 tag + length，返回完整 DER 的有效字节数。
 * 用于截断私钥 base64 解码后可能存在的多余尾部数据。
 */
function getDerTotalLength(bytes: Uint8Array): number {
  if (bytes.length < 2 || bytes[0] !== 0x30) {
    // 不是 SEQUENCE 标签，无法解析，返回原始长度
    return bytes.length;
  }

  const firstLenByte = bytes[1];

  if (firstLenByte < 0x80) {
    // 短格式：长度直接编码在 1 字节中
    return 2 + firstLenByte;
  }

  // 长格式：firstLenByte 的低 7 位表示后续有几个字节用于编码长度
  const numLenBytes = firstLenByte & 0x7f;

  if (numLenBytes === 0 || numLenBytes > 4 || 2 + numLenBytes > bytes.length) {
    return bytes.length;
  }

  let contentLen = 0;

  for (let i = 0; i < numLenBytes; i++) {
    contentLen = (contentLen << 8) | bytes[2 + i];
  }

  // 总长度 = tag(1) + 首字节(1) + 长度字节数 + 内容长度
  return 2 + numLenBytes + contentLen;
}

/** 将 PKCS#1 (RSA PRIVATE KEY) DER 字节包装为 PKCS#8 (PRIVATE KEY) DER 字节。 */
function wrapPkcs1ToPkcs8(pkcs1: Uint8Array) {
  // PKCS#8 PrivateKeyInfo ASN.1 结构：
  // SEQUENCE { version INTEGER(0), algorithm AlgorithmIdentifier, privateKey OCTET STRING }
  const algorithmId = new Uint8Array([
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // OID rsaEncryption
    0x05, 0x00, // NULL
  ]);
  const version = new Uint8Array([0x02, 0x01, 0x00]);

  // OCTET STRING 包裹 PKCS#1 字节
  const octetString = derWrap(0x04, pkcs1);
  // 外层 SEQUENCE
  const content = concatBytes(version, algorithmId, octetString);
  return derWrap(0x30, content);
}

/** 用 DER tag + length 包裹内容。 */
function derWrap(tag: number, content: Uint8Array) {
  const len = content.length;
  let header: Uint8Array;

  if (len < 0x80) {
    header = new Uint8Array([tag, len]);
  } else if (len < 0x100) {
    header = new Uint8Array([tag, 0x81, len]);
  } else {
    header = new Uint8Array([tag, 0x82, (len >> 8) & 0xff, len & 0xff]);
  }

  return concatBytes(header, content);
}

function concatBytes(...arrays: Uint8Array[]) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function importPrivateKey(privateKeyPem: string) {
  const isPkcs1 = privateKeyPem.includes("RSA PRIVATE KEY");
  let keyBytes = base64ToBytes(normalizePem(privateKeyPem));

  // 根据 DER 外层 SEQUENCE 声明的长度截断多余尾部数据
  const expectedLen = getDerTotalLength(keyBytes);

  if (keyBytes.length > expectedLen) {
    console.warn(
      `[alipay] 私钥 DER 有 ${
        keyBytes.length - expectedLen
      } 字节多余尾部数据，已自动截断`
    );
    keyBytes = keyBytes.slice(0, expectedLen);
  }

  // Web Crypto API 只支持 PKCS#8，如果是 PKCS#1 需要包装
  if (isPkcs1) {
    keyBytes = wrapPkcs1ToPkcs8(keyBytes);
  }

  return crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    SIGN_ALGORITHM,
    false,
    ["sign"]
  );
}

async function importPublicKey(publicKeyPem: string) {
  return crypto.subtle.importKey(
    "spki",
    base64ToBytes(normalizePem(publicKeyPem)),
    SIGN_ALGORITHM,
    false,
    ["verify"]
  );
}

export function formatAmount(amount: number) {
  return amount.toFixed(2);
}

/** 生成商户支付单号，要求全局唯一且长度不超过支付宝限制。 */
export function createOutTradeNo(orderId: string) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const normalizedOrderId = orderId
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase()
    .slice(-16);
  const random = crypto
    .getRandomValues(new Uint32Array(1))[0]
    .toString(36)
    .toUpperCase()
    .slice(0, 4);

  return `ALI${stamp}${normalizedOrderId}${random}`.slice(0, 64);
}

/** 对支付宝参数进行 RSA2 签名。 */
export async function signAlipayParams(
  params: Record<string, string | undefined>,
  privateKeyPem: string
) {
  const canonicalQuery = createCanonicalQuery(params);
  const privateKey = await importPrivateKey(privateKeyPem);
  const signedBuffer = await crypto.subtle.sign(
    SIGN_ALGORITHM,
    privateKey,
    new TextEncoder().encode(canonicalQuery)
  );

  return bytesToBase64(new Uint8Array(signedBuffer));
}

export async function buildAlipayOrderString(
  options: BuildAlipayOrderStringOptions
) {
  // 这里构造的是 alipay.trade.app.pay 所需的参数集合。
  const params: Record<string, string | undefined> = {
    app_id: options.appId,
    method: "alipay.trade.app.pay",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(options.timestamp ?? new Date()),
    version: "1.0",
    notify_url: options.notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: options.outTradeNo,
      product_code: "QUICK_MSECURITY_PAY",
      total_amount: options.totalAmount,
      subject: options.subject,
      timeout_express: options.timeoutExpress ?? ALIPAY_TIMEOUT_EXPRESS,
      body: options.body,
    }),
    seller_id: options.sellerId,
  };

  const sign = await signAlipayParams(params, options.privateKeyPem);

  return createEncodedQuery({
    ...params,
    sign,
  });
}

async function callAlipayOpenApi(options: AlipayOpenApiOptions) {
  const params: Record<string, string | undefined> = {
    app_id: options.appId,
    method: options.method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: formatTimestamp(options.timestamp ?? new Date()),
    version: "1.0",
    biz_content: JSON.stringify(options.bizContent),
    seller_id: options.sellerId,
  };

  const sign = await signAlipayParams(params, options.privateKeyPem);
  const body = createEncodedQuery({
    ...params,
    sign,
  });

  const response = await fetch(options.gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body,
  });

  const responseText = await response.text();
  let parsed: Record<string, unknown> = {};

  try {
    parsed = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`支付宝网关响应解析失败：${responseText || "empty response"}`);
  }

  if (!response.ok) {
    throw new Error(`调用支付宝网关失败：HTTP ${response.status}`);
  }

  return parsed;
}

export async function closeAlipayTrade(options: {
  gatewayUrl: string;
  appId: string;
  privateKeyPem: string;
  outTradeNo: string;
  sellerId?: string;
  timestamp?: Date;
}): Promise<AlipayTradeCloseResult> {
  const rawResponse = await callAlipayOpenApi({
    gatewayUrl: options.gatewayUrl,
    appId: options.appId,
    privateKeyPem: options.privateKeyPem,
    method: "alipay.trade.close",
    bizContent: {
      out_trade_no: options.outTradeNo,
    },
    sellerId: options.sellerId,
    timestamp: options.timestamp,
  });

  const payload = rawResponse["alipay_trade_close_response"] as
    | Record<string, unknown>
    | undefined;
  const code = typeof payload?.code === "string" ? payload.code : null;
  const subCode = typeof payload?.sub_code === "string" ? payload.sub_code : null;
  const message =
    (typeof payload?.sub_msg === "string" && payload.sub_msg) ||
    (typeof payload?.msg === "string" && payload.msg) ||
    "调用支付宝关单接口失败。";

  return {
    success: code === "10000",
    code,
    subCode,
    message,
    rawResponse,
  };
}

/** 验证支付宝异步通知签名，忽略 sign 和 sign_type 字段本身。 */
export async function verifyAlipaySignature(
  params: Record<string, string>,
  publicKeyPem: string
) {
  const sign = params.sign;

  if (!sign) {
    return false;
  }

  const signPayload: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (key === "sign" || key === "sign_type" || value === "") {
      continue;
    }

    signPayload[key] = value;
  }

  const canonicalQuery = createCanonicalQuery(signPayload);
  const publicKey = await importPublicKey(publicKeyPem);

  return crypto.subtle.verify(
    SIGN_ALGORITHM,
    publicKey,
    base64ToBytes(sign),
    new TextEncoder().encode(canonicalQuery)
  );
}

/** 将支付宝 notify 的 form-urlencoded 请求体还原成对象。 */
export function parseFormBody(rawBody: string) {
  const formData = new URLSearchParams(rawBody);
  const result: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    result[key] = value;
  }

  return result;
}
