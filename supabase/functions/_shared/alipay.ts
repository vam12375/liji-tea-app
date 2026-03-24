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

/** 去掉 PEM 包裹头尾和空白，转换为可导入的纯 base64 内容。 */
function normalizePem(pem: string) {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
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

async function importPrivateKey(privateKeyPem: string) {
  return crypto.subtle.importKey(
    "pkcs8",
    base64ToBytes(normalizePem(privateKeyPem)),
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
      timeout_express: options.timeoutExpress ?? "15m",
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
