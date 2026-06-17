
export interface JWTPayload {
  userId: string;
  tokenVersion: number;
  exp: number; // 毫秒或秒？标准 JWT exp 是秒级时间戳
}

// 辅助函数：将 ArrayBuffer 转换为 Base64URL
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// 辅助函数：将 Base64URL 转换为 ArrayBuffer
function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

// 辅助函数：将字符串转换为 Uint8Array
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const keyData = textEncoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * 签名生成 JWT Token (HS256)
 * @param payload 荷载
 * @param secret 密钥
 */
export async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);

  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const encodedHeader = bufferToBase64Url(textEncoder.encode(JSON.stringify(header)).buffer);
  const encodedPayload = bufferToBase64Url(textEncoder.encode(JSON.stringify(payload)).buffer);
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(dataToSign).buffer
  );

  const signature = bufferToBase64Url(signatureBuffer);
  return `${dataToSign}.${signature}`;
}

/**
 * 校验并解析 JWT Token
 * @param token JWT 字符串
 * @param secret 密钥
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const key = await getCryptoKey(secret);
    const dataToVerify = `${headerB64}.${payloadB64}`;

    const signature = base64UrlToBuffer(signatureB64);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      textEncoder.encode(dataToVerify).buffer
    );

    if (!isValid) {
      return null;
    }

    const payloadStr = textDecoder.decode(base64UrlToBuffer(payloadB64));
    const payload = JSON.parse(payloadStr) as JWTPayload;

    // 检查过期时间
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowInSeconds) {
      return null;
    }

    return payload;
  } catch (error) {
    // 捕获可能的数据解析或 Web Crypto 报错
    return null;
  }
}
