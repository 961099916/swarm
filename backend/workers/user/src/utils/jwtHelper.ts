// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/utils/jwtHelper.ts

export interface JWTPayload {
  userId: string;
  tokenVersion: number;
  exp: number; // 秒级时间戳
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

const textEncoder = new TextEncoder();

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
