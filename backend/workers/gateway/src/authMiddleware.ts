import { type UserRow, users } from "@swarm/identity";
import { CacheService, TraceLogger, ApiRes } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/authMiddleware.ts

import { verifyJWT, type JWTPayload } from "./jwtHelper";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

const drizzleCache = new WeakMap<D1Database, ReturnType<typeof drizzle>>();

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

function extractBearerToken(authHeader: string | null): string | undefined {
  const bearerPrefix = "Bearer ";
  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    return undefined;
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
  const token = extractBearerToken(authHeader);
  if (!token) {
    return { response: ApiRes.unauthorized("请先登录", traceId) };
  }

  // 1. 解密 JWT 令牌基础签名与时效
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) {
    return { response: ApiRes.unauthorized("Token 无效或已过期，请重新登录", traceId) };
  }

  const userId = payload.userId;

  try {
    const cacheKey = `user:auth:${userId}`;
    let authInfo: UserCachePayload | null | undefined;

    // 2. 优先从 CACHE_KV 读取用户鉴权快照
    try {
      authInfo = await CacheService.get<UserCachePayload>(kv, cacheKey);
    } catch (kvErr: unknown) {
      // 容错机制：KV 异常自动降级直接查 D1，保障业务可用性
      TraceLogger.warn("GATEWAY", "CACHE_KV_DEGRADED", traceId, `KV读取鉴权快照发生异常，降级回源 D1`, userId);
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
        return { response: ApiRes.unauthorized("用户不存在，请重新登录", traceId) };
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
      return { response: ApiRes.unauthorized("用户凭证无效，请重新登录", traceId) };
    } else if (!authInfo.role) {
      // 5. 【防御旧格式缓存】role 字段缺失，说明命中了代码升级前写入的旧快照
      // 主动删除该失效 key，强制回源 D1 重新构建完整的鉴权快照
      TraceLogger.warn("GATEWAY", "CACHE_STALE_FORMAT", traceId, `KV 缓存快照缺少 role 字段(旧格式)，强制删除并回源 D1`, userId);
      await CacheService.delete(kv, cacheKey).catch(() => {});

      const drizzleDb = getDrizzleDb(db);
      const results = await drizzleDb
        .select({ tokenVersion: users.tokenVersion, isBanned: users.isBanned, role: users.role })
        .from(users)
        .where(eq(users.id, userId));

      if (!results || results.length === 0) {
        return { response: ApiRes.unauthorized("用户不存在，请重新登录", traceId) };
      }

      const dbUser = results[0];
      authInfo = { tokenVersion: dbUser.tokenVersion, isBanned: dbUser.isBanned, role: dbUser.role };
      // 以新格式回写缓存，后续请求直接命中完整快照
      await CacheService.set(kv, cacheKey, authInfo, 3600).catch(() => {});
    }

    // 6. 校验快照状态
    if (authInfo.tokenVersion !== payload.tokenVersion) {
      TraceLogger.info("GATEWAY", "TOKEN_VERSION_REVOKED", traceId, `用户凭证已失效(版本变更) 被迫下线`, userId);
      return { response: ApiRes.unauthorized("登录凭证已失效，已被强制下线", traceId) };
    }

    if (authInfo.isBanned === 1) {
      TraceLogger.warn("GATEWAY", "USER_BANNED_BLOCK", traceId, `封禁用户 API 访问拦截`, userId);
      return { response: ApiRes.forbidden("您的账号已被封禁，无权执行此操作", traceId) };
    }

    // 鉴权通过，返回身份元数据
    return { userId, userRole: authInfo.role };
  } catch (error: unknown) {
    TraceLogger.error("GATEWAY", "AUTH_DB_FAILED", traceId, `系统鉴权数据库通信故障`, error, userId);
    return { response: ApiRes.internalError("系统鉴权服务繁忙，请稍后再试", traceId) };
  }
}
