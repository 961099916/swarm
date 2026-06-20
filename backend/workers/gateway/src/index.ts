// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/index.ts

import { Hono } from "hono";
import { CircuitBreaker, ApiRes, TraceLogger, ROUTE_TABLE, startupSecurityCheck, getErrorMessage } from "@swarm/kernel";
import type { Context, Next } from "hono";
import { authenticateRequest } from "./authMiddleware";
import { checkRateLimit, buildRateLimitResponse } from "./rateLimiter";
import { GatewayConstants } from "./constants/gateway.constant";

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  // Service Bindings
  CORE_SVC: Fetcher;       // 核心用户与资产服务
  ENGINE_SVC: Fetcher;     // 智能体与任务服务
  ADMIN_SVC: Fetcher;      // 管理后台服务
  QUIZ_SVC: Fetcher;       // 闯关评测服务
  RAG_SVC: Fetcher;        // RAG 知识库服务
  // Secrets
  INTERNAL_SECRET: string;
  JWT_SECRET: string;
  // Vars
  ALLOWED_ORIGIN?: string;
}

interface GatewayVariables {
  traceId: string;
  userId?: string;
  userRole?: string;
}

const app = new Hono<{ Bindings: Env; Variables: GatewayVariables }>();

// ══════════════════════════════════════════════════
// 辅助日志/安全校验小函数 (符合函数行数不超过40行规范)
// ══════════════════════════════════════════════════

async function tryParseRequestBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const clonedReq = req.clone();
    return await clonedReq.json() as Record<string, unknown>;
  } catch (err) {
    return null;
  }
}

async function tryParseResponseBody(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const clonedRes = res.clone();
    const text = await clonedRes.text();
    if (text.length < 2000) {
      return JSON.parse(text);
    }
    return { truncated: text.slice(0, 1000) + "... (truncated)" };
  } catch (err) {
    return null;
  }
}

async function handleInboundLog(c: Context, traceId: string, isAvatar: boolean) {
  if (isAvatar) return;
  let requestBody: Record<string, unknown> | null = null;
  const contentType = c.req.header("Content-Type") || "";
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && contentType.includes("application/json")) {
    requestBody = await tryParseRequestBody(c.req.raw);
  }
  TraceLogger.info(
    "GATEWAY",
    "REQUEST_INBOUND",
    traceId,
    `网关接收请求: ${c.req.method} ${c.req.path}`,
    undefined,
    { query: c.req.query(), body: requestBody }
  );
}

async function handleOutboundLog(c: Context, traceId: string, isAvatar: boolean, durationMs: number) {
  if (isAvatar || !c.res) return;
  let responseBody: Record<string, unknown> | null = null;
  const resContentType = c.res.headers.get("Content-Type") || "";
  if (resContentType.includes("application/json")) {
    responseBody = await tryParseResponseBody(c.res);
  }
  TraceLogger.info(
    "GATEWAY",
    "REQUEST_OUTBOUND",
    traceId,
    `网关响应完成: ${c.req.method} ${c.req.path} -> [${c.res.status}] (${durationMs}ms)`,
    c.get("userId"),
    { status: c.res.status, durationMs, response: responseBody }
  );
}

// ══════════════════════════════════════════════════
// 全局中间件
// ══════════════════════════════════════════════════

/** TraceID 注入与统一入参/出参日志 */
app.use("*", async (c: Context, next: Next) => {
  const isAvatar = c.req.path.startsWith("/avatars/");
  const traceId = c.req.header(GatewayConstants.HEADER_TRACE_ID) || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header(GatewayConstants.HEADER_TRACE_ID, traceId);

  const checkError = await startupSecurityCheck(c.env, traceId, ["INTERNAL_SECRET", "JWT_SECRET"]);
  if (checkError) return checkError;

  await handleInboundLog(c, traceId, isAvatar);
  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;
  await handleOutboundLog(c, traceId, isAvatar, durationMs);
});

/** CORS 跨域处理 — 动态白名单匹配 */
app.use("*", async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    const corsOrigin = getCorsOriginHeader(c);
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trace-Id",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  await next();
});

/** 请求体大小限制 — 防止超大 Payload 攻击 */
app.use("/api/v1/*", async (c: Context, next: Next) => {
  const traceId = c.get("traceId");
  const contentLength = c.req.header("Content-Length");
  if (contentLength) {
    const bytes = parseInt(contentLength, 10);
    if (bytes > GatewayConstants.MAX_BODY_SIZE) {
      TraceLogger.warn("GATEWAY", "PAYLOAD_TOO_LARGE", traceId, `请求体超限: ${bytes} bytes`);
      return applyCors(c, ApiRes.badRequest("请求体过大，最大允许 1MB", traceId));
    }
  }
  await next();
});

// ─── 统一鉴权拦截器 (除了微信小程序登录接口外，拦截所有 /api/v1/ 路由) ───
app.use("/api/v1/*", async (c: Context, next: Next) => {
  if (c.req.path === "/api/v1/auth/login" || c.req.path === "/api/v1/auth/admin/login") {
    return next();
  }
  const traceId = c.get("traceId");
  const result = await authenticateRequest(c.req.raw, c.env.DB, c.env.CACHE_KV, c.env.JWT_SECRET, traceId);
  if (result.response) {
    return applyCors(c, result.response);
  }
  c.set("userId", result.userId!);
  c.set("userRole", result.userRole!);
  await next();
});

// ─── 速率限制 (Rate Limiting) — 基于 KV 的滑动窗口 ───
app.use("/api/v1/*", async (c: Context, next: Next) => {
  if (c.req.path === "/api/v1/auth/login" || c.req.path === "/api/v1/auth/admin/login") {
    return next();
  }
  const traceId = c.get("traceId");
  const userId = c.get("userId") || "anonymous";
  const result = await checkRateLimit({
    kv: c.env.CACHE_KV,
    maxRequests: GatewayConstants.RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: GatewayConstants.RATE_LIMIT_WINDOW_SECONDS,
    identifier: userId,
    traceId,
  });
  if (!result.allowed) {
    TraceLogger.warn("GATEWAY", "RATE_LIMIT_EXCEEDED", traceId, `用户请求频率超限`, userId);
    return applyCors(c, buildRateLimitResponse(result, traceId));
  }
  await next();
});

// ══════════════════════════════════════════════════
// 路由分发 (声明式路由注册表，基于 ROUTE_TABLE)
// ══════════════════════════════════════════════════

for (const entry of ROUTE_TABLE) {
  const pathPattern = entry.prefix.endsWith("/*") ? entry.prefix : `${entry.prefix}/*`;
  app.all(pathPattern, async (c) => {
    const traceId = c.get("traceId");
    const userRole = c.get("userRole");

    if (entry.publicPaths && entry.publicPaths.some(p => c.req.path === p)) {
      const svc = (c.env as any)[entry.target] as Fetcher | undefined;
      return await forwardToInternalSvc(c, svc!, entry.label);
    }
    if (entry.requireAdmin && userRole !== "ADMIN") {
      TraceLogger.warn("GATEWAY", "FORBIDDEN_ADMIN_ACCESS", traceId, `非 ADMIN 用户尝试访问 ${entry.label} 被网关拦截`, c.get("userId") as string | undefined);
      return applyCors(c, ApiRes.forbidden("权限不足：您无权执行管理员操作", traceId));
    }
    if (entry.requireRoles && !entry.requireRoles.includes(userRole || "")) {
      TraceLogger.warn("GATEWAY", "FORBIDDEN_ROLE", traceId, `用户角色 ${userRole} 无权访问 ${entry.label}`, c.get("userId") as string | undefined);
      return applyCors(c, ApiRes.forbidden("权限不足", traceId));
    }
    const svc = (c.env as any)[entry.target] as Fetcher | undefined;
    return await forwardToInternalSvc(c, svc!, entry.label);
  });
}

app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "gateway", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  const traceId = c.get("traceId");
  return applyCors(c, ApiRes.notFound("请求的接口不存在", traceId || "SYSTEM"));
});

app.onError(async (err, c) => {
  const traceId = c.get("traceId") || crypto.randomUUID();
  TraceLogger.error("GATEWAY", "UNCAUGHT_EXCEPTION", traceId, `网关未捕获异常: ${getErrorMessage(err)}`, err);
  return applyCors(c, ApiRes.internalError("网关未知异常，请联系系统管理员", traceId || "SYSTEM"));
});

// ══════════════════════════════════════════════════
// 辅助函数 (行数约束拆分)
// ══════════════════════════════════════════════════

function applyCors(c: Context, response: Response): Response {
  const corsOrigin = getCorsOriginHeader(c);
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", corsOrigin);
  const traceId = c.get("traceId");
  if (traceId) {
    newHeaders.set(GatewayConstants.HEADER_TRACE_ID, traceId);
    newHeaders.set("Access-Control-Expose-Headers", GatewayConstants.HEADER_TRACE_ID);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// ──────────────────────────────────────────────────
// 动态 CORS 白名单验证与放行逻辑
// ──────────────────────────────────────────────────

const CORS_WHITELIST_REGEX = [
  /^http:\/\/localhost(:\d+)?$/,               // 本地开发域名
  /^https:\/\/.*\.pages\.dev$/,                // Cloudflare Pages 子域名
  /^https:\/\/swarm-gateway\.jiuxia\.online$/, // 自定义绑定域名
];

function isOriginAllowed(origin: string | null, envAllowedOrigin?: string): boolean {
  if (!origin) return false;
  for (const regex of CORS_WHITELIST_REGEX) {
    if (regex.test(origin)) return true;
  }
  if (envAllowedOrigin && origin === envAllowedOrigin) return true;
  return false;
}

function getCorsOriginHeader(c: Context): string {
  const origin = c.req.header("Origin");
  if (origin && isOriginAllowed(origin, c.env.ALLOWED_ORIGIN)) {
    return origin;
  }
  return c.env.ALLOWED_ORIGIN || "*";
}

function buildInternalReqHeaders(c: Context, traceId: string): Headers {
  const internalHeaders = new Headers(c.req.raw.headers);
  internalHeaders.set(GatewayConstants.HEADER_INTERNAL_KEY, c.env.INTERNAL_SECRET);
  internalHeaders.set(GatewayConstants.HEADER_TRACE_ID, traceId);
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  if (userId) {
    internalHeaders.set(GatewayConstants.HEADER_USER_ID, userId);
  }
  if (userRole) {
    internalHeaders.set(GatewayConstants.HEADER_USER_ROLE, userRole);
  }
  return internalHeaders;
}

async function executeInternalRequest(
  svcFetcher: Fetcher,
  internalReq: Request,
  cb: CircuitBreaker,
  traceId: string,
  svcName: string,
  userId?: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GatewayConstants.FORWARD_TIMEOUT_MS);
  try {
    const response = await svcFetcher.fetch(internalReq, { signal: controller.signal });
    await cb.onSuccess();
    return response;
  } catch (svcError: unknown) {
    const isTimeout = svcError instanceof Error && svcError.name === "AbortError";
    TraceLogger.error("GATEWAY", isTimeout ? "SERVICE_FORWARD_TIMEOUT" : "SERVICE_FORWARD_ERROR", traceId,
      `${svcName} ${isTimeout ? "响应超时" : "内部通信故障"}: ${getErrorMessage(svcError)}`, svcError, userId);
    await cb.onFailure();
    throw svcError;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Service Binding 高效转发函数，内置超时熔断
 */
async function forwardToInternalSvc(
  c: Context,
  svcFetcher: Fetcher,
  svcName: string
): Promise<Response> {
  const traceId = c.get("traceId");
  const userId = c.get("userId");

  if (!svcFetcher || typeof svcFetcher.fetch !== "function") {
    TraceLogger.error("GATEWAY", "SERVICE_BINDING_MISSING", traceId, `微服务转发失败: 未检测到 ${svcName} 资源绑定`);
    return applyCors(c, ApiRes.serviceUnavailable("系统服务暂不可用，请稍后再试", traceId));
  }

  const internalHeaders = buildInternalReqHeaders(c, traceId);
  let body: ReadableStream<Uint8Array> | null = null;
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    try {
      body = c.req.raw.clone().body;
    } catch {}
  }

  const internalReq = new Request(c.req.url, {
    method: c.req.method,
    headers: internalHeaders,
    body,
    redirect: "manual"
  });

  const cb = new CircuitBreaker(c.env.DB, svcName, traceId);
  if (!await cb.allowRequest()) {
    const status = await cb.getStatus();
    TraceLogger.warn("GATEWAY", "CIRCUIT_OPEN", traceId, `${svcName} 熔断器已开启 (连续失败 ${status.failureCount} 次)`, userId);
    return applyCors(c, ApiRes.serviceUnavailable(`${svcName} 暂时不可用，请稍后重试`, traceId));
  }

  try {
    const response = await executeInternalRequest(svcFetcher, internalReq, cb, traceId, svcName, userId);
    return applyCors(c, response);
  } catch (err) {
    return applyCors(c, ApiRes.serviceUnavailable("内部业务服务超时，请稍后重试", traceId));
  }
}

export default app;
