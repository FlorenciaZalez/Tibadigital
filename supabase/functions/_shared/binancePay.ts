const BINANCE_API_BASE_URL = "https://bpay.binanceapi.com";

export interface BinancePayConfig {
  apiKey: string;
  secretKey: string;
}

export interface BinanceOrderMeta {
  provider: "binance_pay";
  merchantTradeNo: string;
  prepayId: string;
  checkoutUrl: string;
  deeplink: string | null;
  universalUrl: string | null;
  qrcodeLink: string | null;
  qrContent: string | null;
  expireTime: number;
  status: string;
  orderAmount: string;
  currency: string;
  fiatAmount: string | null;
  fiatCurrency: string | null;
  transactionId: string | null;
  passThroughInfo: string | null;
}

const encoder = new TextEncoder();

export const getBinancePayConfig = () => {
  const apiKey = Deno.env.get("BINANCE_PAY_API_KEY");
  const secretKey = Deno.env.get("BINANCE_PAY_SECRET_KEY");

  if (!apiKey || !secretKey) {
    throw new Error("BINANCE_PAY_API_KEY and BINANCE_PAY_SECRET_KEY must be configured");
  }

  return { apiKey, secretKey } satisfies BinancePayConfig;
};

export const isBinancePayConfigured = () => Boolean(Deno.env.get("BINANCE_PAY_API_KEY") && Deno.env.get("BINANCE_PAY_SECRET_KEY"));

export const buildMerchantTradeNo = (orderId: string) => {
  const normalizedOrderId = orderId.replace(/-/g, "").toLowerCase();
  const suffix = Date.now().toString(36).replace(/[^a-z0-9]/g, "").slice(-8).padStart(8, "0");
  return `${normalizedOrderId.slice(0, 24)}${suffix}`.slice(0, 32);
};

export const signBinancePayload = async (payload: string, config: BinancePayConfig, timestamp: string, nonce: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const content = `${timestamp}\n${nonce}\n${payload}\n`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(content));
  return toHex(signature).toUpperCase();
};

export const callBinancePay = async <T>(
  path: string,
  body: Record<string, unknown>,
  config = getBinancePayConfig(),
) => {
  const payload = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const signature = await signBinancePayload(payload, config, timestamp, nonce);

  const response = await fetch(`${BINANCE_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": timestamp,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": config.apiKey,
      "BinancePay-Signature": signature,
    },
    body: payload,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.status !== "SUCCESS" || data.code !== "000000") {
    throw new Error(data?.errorMessage || data?.message || `Binance Pay request failed (${response.status})`);
  }

  return data as T;
};

export const queryBinanceOrder = async (merchantTradeNo: string, config = getBinancePayConfig()) => {
  const response = await callBinancePay<{ data: Record<string, unknown> }>(
    "/binancepay/openapi/v2/order/query",
    { merchantTradeNo },
    config,
  );
  return response.data;
};

export const listBinanceCertificates = async (config = getBinancePayConfig()) => {
  const response = await callBinancePay<{ data: Array<{ certSerial: string; certPublic: string }> }>(
    "/binancepay/openapi/certificates",
    {},
    config,
  );
  return response.data;
};

export const verifyBinanceWebhookSignature = async (body: string, headers: Headers) => {
  const timestamp = headers.get("BinancePay-Timestamp");
  const nonce = headers.get("BinancePay-Nonce");
  const signature = headers.get("BinancePay-Signature");
  const certificateSn = headers.get("BinancePay-Certificate-SN");

  if (!timestamp || !nonce || !signature || !certificateSn) {
    throw new Error("Missing Binance Pay signature headers");
  }

  const configuredPublicKey = Deno.env.get("BINANCE_PAY_WEBHOOK_PUBLIC_KEY")?.trim();
  const configuredCertSn = Deno.env.get("BINANCE_PAY_WEBHOOK_CERT_SN")?.trim();

  let publicKeyPem = configuredPublicKey && (!configuredCertSn || configuredCertSn === certificateSn)
    ? configuredPublicKey
    : null;

  if (!publicKeyPem) {
    const certificates = await listBinanceCertificates();
    publicKeyPem = certificates.find((item) => item.certSerial === certificateSn)?.certPublic ?? null;
  }

  if (!publicKeyPem) {
    throw new Error(`Binance Pay certificate ${certificateSn} not found`);
  }

  const importedKey = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(publicKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const payload = `${timestamp}\n${nonce}\n${body}\n`;
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    importedKey,
    base64ToArrayBuffer(signature),
    encoder.encode(payload),
  );

  if (!verified) {
    throw new Error("Invalid Binance Pay webhook signature");
  }
};

export const toBinanceOrderMeta = (data: Record<string, unknown>): BinanceOrderMeta => ({
  provider: "binance_pay",
  merchantTradeNo: String(data.merchantTradeNo ?? ""),
  prepayId: String(data.prepayId ?? ""),
  checkoutUrl: String(data.checkoutUrl ?? ""),
  deeplink: nullableString(data.deeplink),
  universalUrl: nullableString(data.universalUrl),
  qrcodeLink: nullableString(data.qrcodeLink),
  qrContent: nullableString(data.qrContent),
  expireTime: Number(data.expireTime ?? 0),
  status: String(data.status ?? "INITIAL"),
  orderAmount: String(data.orderAmount ?? data.totalFee ?? "0"),
  currency: String(data.currency ?? "USDT"),
  fiatAmount: nullableString(data.fiatAmount),
  fiatCurrency: nullableString(data.fiatCurrency),
  transactionId: nullableString(data.transactionId),
  passThroughInfo: nullableString(data.passThroughInfo),
});

const nullableString = (value: unknown) => value == null ? null : String(value);

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const pemToArrayBuffer = (pem: string) => {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  return base64ToArrayBuffer(base64);
};

const base64ToArrayBuffer = (value: string) => {
  const normalized = value.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};
