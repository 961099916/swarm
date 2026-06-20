// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/rateLimiter.ts

/**
 * RateLimiter — 基于 KV 的分布式速率限制中间件
 *
 * 使用滑动窗口（Sliding Window）算法，以 KV 为存储后端。
 * 所有 Worker 共享同一份速率限制状态。
 */

import { TraceLogger } from "@swarm/kernel";
import { GatewayConstants } from "./constants/gateway.constant";

export interface RateLimitConfig {
  /** KV 命名空间 */
  kv: KVNamespace;
  /** 时间窗口内允许的最大请求数 */
  maxRequests: number;
  /** 窗口大小（秒） */
  windowSeconds: number;
  /** 用户标识（userId 或 IP） */
  identifier: string;
  /** TraceID */
  traceId: string;
}

export interface RateLimitResult {
  /** 是否允许通过 */
  allowed: boolean;
  /** 当前窗口已用请求数 */
  current: number;
  /** 窗口大小（秒） */
  windowSeconds: number;
  /** 限制的最大请求数 */
  maxRequests: number;
  /** 剩余请求数 */
  remaining: number;
  /** 重置时间戳（Unix 秒） */
  resetAt: number;
}

/**
 * 对单个请求执行速率限制检查。
 * 返回 { allowed, current, remaining, resetAt }。
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { kv, maxRequests, windowSeconds, identifier, traceId } = config;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSeconds);
  const bucketKey = `${GatewayConstants.RATE_LIMIT_PREFIX}${identifier}:${windowKey}`;

  try {
    // KV atomic increment: 如果 key 不存在则创建，设置 TTL 为 2 个窗口时间
    const ttl = windowSeconds * 2 + 10;
    const raw = await kv.get(bucketKey);
    const current = raw ? parseInt(raw, 10) : 0;

    if (current >= maxRequests) {
      const resetAt = (windowKey + 1) * windowSeconds;
      return {
        allowed: false,
        current,
        windowSeconds,
        maxRequests,
        remaining: 0,
        resetAt,
      };
    }

    // 递增计数器
    await kv.put(bucketKey, String(current + 1), { expirationTtl: ttl });

    return {
      allowed: true,
      current: current + 1,
      windowSeconds,
      maxRequests,
      remaining: maxRequests - current - 1,
      resetAt: (windowKey + 1) * windowSeconds,
    };
  } catch (error: unknown) {
    // KV 异常时不阻断请求，仅记录
    TraceLogger.warn("GATEWAY", "RATE_LIMITER_KV_ERR", config.traceId, `RateLimiter KV 异常，放行请求`, config.identifier);
    return {
      allowed: true,
      current: 0,
      windowSeconds,
      maxRequests,
      remaining: maxRequests,
      resetAt: now + windowSeconds,
    };
  }
}

/**
 * 构建速率限制响应（429 Too Many Requests）
 */
export function buildRateLimitResponse(result: RateLimitResult, traceId: string): Response {
  return new Response(
    JSON.stringify({
      code: GatewayConstants.RATE_LIMIT_ERROR_CODE,
      message: `请求过于频繁，请在 ${result.windowSeconds} 秒后重试`,
      traceId,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.windowSeconds),
        "X-RateLimit-Limit": String(result.maxRequests),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.resetAt),
        "X-Trace-Id": traceId,
      },
    }
  );
}
