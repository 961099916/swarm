// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/authMiddleware.ts

import { verifyJWT, type JWTPayload } from "./jwtHelper";
import { users, type UserRow, TraceLogger, CacheService } from "@swarm/shared";
import { ResponseBuilder } from "./utils/response";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

const drizzleCache = new WeakMap<D1Database, any>();

function getDrizzleDb(db: D1Database) {
  let client = drizzleCache.get(db);
  if (!client) {
    client = drizzle(db);
    drizzleCache.set(db, client);
  }
  return client;
}

export interface AuthResult {
  userId?: string;
  userRole?: string;
  response?: Response;
}

interface UserCachePayload {
  tokenVersion: number;
  isBanned: number;
  role: string;
}

function extractBearerToken(authHeader: string | null, traceId: string): string | Response {
  const bearerPrefix = "Bearer ";
  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    return ResponseBuilder.error("请先登录", traceId, 401);
  }
  return authHeader.substring(bearerPrefix.length);
}

/**
 * 校验用户的 JWT 令牌，并优先使用 KV 缓存比对用户状态，大幅释放高并发下的 D1 读负载
 */
export async function authenticateRequest(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  jwtSecret: string,
  traceId: string
): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");
  const tokenOrResponse = extractBearerToken(authHeader, traceId);
  if (tokenOrResponse instanceof Response) {
    return { response: tokenOrResponse };
  }

  // 1. 解密 JWT 令牌基础签名与时效
  const payload = await verifyJWT(tokenOrResponse, jwtSecret);
  if (!payload) {
    return { response: ResponseBuilder.error("Token 无效或已过期，请重新登录", traceId, 401) };
  }

  const userId = payload.userId;

  try {
    const cacheKey = `user:auth:${userId}`;
    let authInfo: UserCachePayload | null | undefined;

    // 2. 优先从 CACHE_KV 读取用户鉴权快照
    try {
      authInfo = await CacheService.get<UserCachePayload>(kv, cacheKey);
    } catch (kvErr: any) {
      // 容错机制：KV 异常自动降级直接查 D1，保障业务可用性
      TraceLogger.warn("GATEWAY", "CACHE_KV_DEGRADED", traceId, `KV读取鉴权快照发生异常: ${kvErr.message || kvErr}，降级回源 D1`, userId);
      authInfo = undefined;
    }

    if (authInfo === undefined) {
      // 3. 缓存未命中，回源查 D1 数据库
      const drizzleDb = getDrizzleDb(db);
      const results = await drizzleDb
        .select({ tokenVersion: users.tokenVersion, isBanned: users.isBanned, role: users.role })
        .from(users)
        .where(eq(users.id, userId));

      if (!results || results.length === 0) {
        // 缓存占位防穿透，阻止恶意撞库
        await CacheService.set(kv, cacheKey, null, 300).catch(() => {});
        return { response: ResponseBuilder.error("用户不存在，请重新登录", traceId, 401) };
      }

      const dbUser = results[0];
      authInfo = {
        tokenVersion: dbUser.tokenVersion,
        isBanned: dbUser.isBanned,
        role: dbUser.role
      };

      // 4. 回写 KV 缓存 (TTL: 1 小时，CacheService 会自动添加 Jitter 偏移)
      await CacheService.set(kv, cacheKey, authInfo, 3600).catch(() => {});
    } else if (authInfo === null) {
      // 占位命中，直接拦截
      return { response: ResponseBuilder.error("用户凭证无效，请重新登录", traceId, 401) };
    } else if (!authInfo.role) {
      // 5. 【防御旧格式缓存】role 字段缺失，说明命中了代码升级前写入的旧快照
      // 主动删除该失效 key，强制回源 D1 重新构建完整的鉴权快照
      TraceLogger.warn("GATEWAY", "CACHE_STALE_FORMAT", traceId, `KV 缓存快照缺少 role 字段(旧格式)，强制删除并回源 D1: userId=${userId}`, userId);
      await CacheService.delete(kv, cacheKey).catch(() => {});

      const drizzleDb = getDrizzleDb(db);
      const results = await drizzleDb
        .select({ tokenVersion: users.tokenVersion, isBanned: users.isBanned, role: users.role })
        .from(users)
        .where(eq(users.id, userId));

      if (!results || results.length === 0) {
        return { response: ResponseBuilder.error("用户不存在，请重新登录", traceId, 401) };
      }

      const dbUser = results[0];
      authInfo = { tokenVersion: dbUser.tokenVersion, isBanned: dbUser.isBanned, role: dbUser.role };
      // 以新格式回写缓存，后续请求直接命中完整快照
      await CacheService.set(kv, cacheKey, authInfo, 3600).catch(() => {});
    }

    // 6. 校验快照状态
    if (authInfo.tokenVersion !== payload.tokenVersion) {
      TraceLogger.info("GATEWAY", "TOKEN_VERSION_REVOKED", traceId, `用户凭证已失效(版本变更) 被迫下线: userId=${userId}`, userId);
      return { response: ResponseBuilder.error("登录凭证已失效，已被强制下线", traceId, 401) };
    }

    if (authInfo.isBanned === 1) {
      TraceLogger.warn("GATEWAY", "USER_BANNED_BLOCK", traceId, `封禁用户 API 访问拦截: userId=${userId}`, userId);
      return { response: ResponseBuilder.error("您的账号已被封禁，无权执行此操作", traceId, 403) };
    }

    // 鉴权通过，返回身份元数据
    return { userId, userRole: authInfo.role };
  } catch (error: any) {
    TraceLogger.error("GATEWAY", "AUTH_DB_FAILED", traceId, `系统鉴权数据库通信故障: ${error.message || error}`, error, userId);
    return { response: ResponseBuilder.internalError("系统鉴权服务繁忙，请稍后再试", traceId) };
  }
}
