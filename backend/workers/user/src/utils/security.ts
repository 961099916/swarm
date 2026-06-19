import { AdRewardReq } from "@swarm/credits";
import { TraceLogger } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/utils/security.ts

/**
 * 将字符串编码为 Uint8Array
 */
function textEncode(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer;
}

/**
 * 将 ArrayBuffer 转为十六进制字符串
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 导入 HMAC 签名密钥
 */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    textEncode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * 校验广告 HMAC Token 的有效性（防刷与重放防御）
 * adToken 格式：Base64Url(PayloadJSON) + "." + Hex(HMAC-SHA256(Base64Url(PayloadJSON)))
 */
export async function verifyAdToken(
  adToken: string,
  jwtSecret: string,
  currentUserId: string,
  traceId: string
): Promise<{ success: boolean; errorMsg?: string }> {
  try {
    const parts = adToken.split(".");
    if (parts.length !== 2) {
      return { success: false, errorMsg: "无效的广告令牌格式" };
    }

    const [encodedPayload, signature] = parts;
    const payloadJsonStr = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJsonStr);

    // 1. 验证签名
    const key = await importHmacKey(jwtSecret);
    const expectedSigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      textEncode(encodedPayload)
    );
    const expectedSig = bufferToHex(expectedSigBuffer);

    if (signature !== expectedSig) {
      TraceLogger.warn("USER", "AD_TOKEN_SECURITY", traceId, `广告 Token 签名不匹配! 传入: ${signature}, 期望: ${expectedSig}`, currentUserId);
      return { success: false, errorMsg: "广告令牌凭证校验失败" };
    }

    // 2. 验证用户归属权（防止盗用他人 Token）
    if (payload.userId !== currentUserId) {
      TraceLogger.warn("USER", "AD_TOKEN_SECURITY", traceId, `广告 Token 所属用户不匹配! Token用户: ${payload.userId}, 当前用户: ${currentUserId}`, currentUserId);
      return { success: false, errorMsg: "不可盗用他人的广告奖励" };
    }

    // 3. 验证时效性（重放攻击防御，限制 5 分钟内兑换）
    const now = Date.now();
    const tokenTime = payload.timestamp;
    const timeDiff = now - tokenTime;

    if (timeDiff < 0 || timeDiff > 5 * 60 * 1000) {
      TraceLogger.warn("USER", "AD_TOKEN_SECURITY", traceId, `广告 Token 已过期或时间戳非法! Token时间: ${tokenTime}, 当前时间: ${now}, 延迟: ${timeDiff}ms`, currentUserId);
      return { success: false, errorMsg: "广告奖励令牌已过期，请在看完广告后5分钟内兑换" };
    }

    return { success: true };
  } catch (err: unknown) {
    TraceLogger.error("USER", "AD_TOKEN_SECURITY", traceId, `解析广告令牌抛出异常: getErrorMessage(err)`, err, currentUserId);
    return { success: false, errorMsg: "令牌解析异常" };
  }
}

/**
 * 辅助生成 adToken 的函数（测试与内部生成）
 */
export async function generateAdToken(
  userId: string,
  adProvider: string,
  adUnitId: string,
  jwtSecret: string
): Promise<string> {
  const payload = {
    userId,
    adProvider,
    adUnitId,
    timestamp: Date.now()
  };
  const payloadStr = JSON.stringify(payload);
  const encodedPayload = btoa(payloadStr)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const key = await importHmacKey(jwtSecret);
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncode(encodedPayload)
  );
  const signature = bufferToHex(signatureBuffer);

  return `${encodedPayload}.${signature}`;
}

/**
 * SSRF URL 安全性校验防火墙
 * 禁止指向 localhost、私有 IP 网段 (RFC 1918) 及回环地址
 */
export function validateSafeUrl(urlStr: string): void {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error("URL 格式不合法");
  }

  const host = url.hostname.toLowerCase();
  
  // 1. 直观 localhost 拦截
  if (host === "localhost" || host === "localhost.localdomain" || host === "::1" || host === "0.0.0.0") {
    throw new Error("安全策略限制：禁止访问内网或环回地址 (SSRF)");
  }

  // 2. IPv4 内网及保留网段正则过滤
  // 匹配:
  // - 127.0.0.0/8 (环回)
  // - 10.0.0.0/8 (私有)
  // - 172.16.0.0/12 (私有)
  // - 192.168.0.0/16 (私有)
  // - 169.254.0.0/16 (链路本地 Link-local)
  const ipv4PrivateRegex = /^(?:127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/;
  if (ipv4PrivateRegex.test(host)) {
    throw new Error("安全策略限制：禁止访问私有内网 IP 网段 (SSRF)");
  }

  // 3. IPv6 链路本地与私有单播地址拦截
  // 匹配:
  // - fe80::/10 (链路本地)
  // - fc00::/7 (私有单播 Unique Local)
  if (host.startsWith("fe80:") || host.startsWith("fc00:") || host.startsWith("fd00:")) {
    throw new Error("安全策略限制：禁止访问 IPv6 链路本地或私有单播地址 (SSRF)");
  }
}
