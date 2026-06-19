import { Hono } from "hono";
import { CircuitBreaker, ApiRes, TraceLogger, ROUTE_TABLE, startupSecurityCheck } from "@swarm/kernel";
import type { Context, Next } from "hono";
import { authenticateRequest } from "./authMiddleware";
import { checkRateLimit, buildRateLimitResponse } from "./rateLimiter";

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
// 全局中间件
// ══════════════════════════════════════════════════

/** TraceID 注入与统一入参/出参日志 */
app.use("*", async (c: Context, next: Next) => {
  const isAvatar = c.req.path.startsWith("/avatars/");
  const traceId = c.req.header("X-Trace-Id") || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("X-Trace-Id", traceId);
  
  // 1. 启动 Fail-Fast 安全预检，验证核心机密是否缺失
  const checkError = await startupSecurityCheck(c.env, traceId, ["INTERNAL_SECRET", "JWT_SECRET"]);
  if (checkError) return checkError;

  // 2. 收集入参日志
  let query: Record<string, string> | null = null;
  let requestBody: Record<string, unknown> | null = null;
  if (!isAvatar) {
    query = c.req.query();
    const contentType = c.req.header("Content-Type") || "";
    if (c.req.method !== "GET" && c.req.method !== "HEAD" && contentType.includes("application/json")) {
      try {
        const clonedReq = c.req.raw.clone();
        requestBody = await clonedReq.json() as Record<string, unknown>;
      } catch (err) {
        // 容错
      }
    }
  }

  if (!isAvatar) {
    TraceLogger.info(
      "GATEWAY",
      "REQUEST_INBOUND",
      traceId,
      `网关接收请求: ${c.req.method} ${c.req.path}`,
      undefined,
      { query, body: requestBody }
    );
  }

  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;

  // 3. 收集出参日志
  if (!isAvatar) {
    let responseBody: Record<string, unknown> | null = null;
    let status = 200;
    if (c.res) {
      status = c.res.status;
      const resContentType = c.res.headers.get("Content-Type") || "";
      if (resContentType.includes("application/json")) {
        try {
          const clonedRes = c.res.clone();
          const text = await clonedRes.text();
          if (text.length < 2000) {
            responseBody = JSON.parse(text);
          } else {
            responseBody = { truncated: text.slice(0, 1000) + "... (truncated)" };
          }
        } catch (err) {
          // 容错
        }
      }
    }

    TraceLogger.info(
      "GATEWAY",
      "REQUEST_OUTBOUND",
      traceId,
      `网关响应完成: ${c.req.method} ${c.req.path} -> [${status}] (${durationMs}ms)`,
      c.get("userId"),
      {
        status,
        durationMs,
        response: responseBody
      }
    );
  }
});

/** CORS 跨域处理 — 生产环境必须设置 ALLOWED_ORIGIN */
app.use("*", async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    // 生产环境：ALLOWED_ORIGIN 必须设为具体域名，禁止通配符
    const allowedOrigin = c.env.ALLOWED_ORIGIN 
      ? c.env.ALLOWED_ORIGIN 
      : "https://swarm-gateway.jiuxia.online"; // 默认生产域名
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
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
    const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB
    if (bytes > MAX_BODY_SIZE) {
      TraceLogger.warn("GATEWAY", "PAYLOAD_TOO_LARGE", traceId, `请求体超限: ${bytes} bytes`);
      return applyCors(c, ApiRes.badRequest("请求体过大，最大允许 1MB", traceId));
    }
  }
  
  await next();
});

// ─── 统一鉴权拦截器 (除了微信小程序登录接口外，拦截所有 /api/v1/ 路由) ───

app.use("/api/v1/*", async (c: Context, next: Next) => {
  if (c.req.path === "/api/v1/auth/login") {
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
// 为经过鉴权的 API 请求添加速率限制，避免滥用
app.use("/api/v1/*", async (c: Context, next: Next) => {
  // 登录接口不做速率限制（已在上面跳过鉴权）
  if (c.req.path === "/api/v1/auth/login") {
    return next();
  }

  const traceId = c.get("traceId");
  const userId = c.get("userId") || "anonymous";
  
  const result = await checkRateLimit({
    kv: c.env.CACHE_KV,
    maxRequests: 120,         // 每分钟最多 120 次请求
    windowSeconds: 60,
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

// 将声明式路由表注册到 Hono
for (const entry of ROUTE_TABLE) {
  const pathPattern = entry.prefix.endsWith("/*") ? entry.prefix : `${entry.prefix}/*`;
  
  app.all(pathPattern, async (c) => {
    const traceId = c.get("traceId");
    const userRole = c.get("userRole");
    
    // 免鉴权路径处理
    if (entry.publicPaths && entry.publicPaths.some(p => c.req.path === p)) {
      const svc = (c.env as any)[entry.target] as Fetcher | undefined;
      return await forwardToInternalSvc(c, svc!, entry.label);
    }
    
    // ADMIN 角色前置拦截
    if (entry.requireAdmin && userRole !== "ADMIN") {
      TraceLogger.warn("GATEWAY", "FORBIDDEN_ADMIN_ACCESS", traceId, `非 ADMIN 用户尝试访问 ${entry.label} 被网关拦截`, c.get("userId"));
      return applyCors(c, ApiRes.forbidden("权限不足：您无权执行管理员操作", traceId));
    }
    
    // 角色验证
    if (entry.requireRoles && !entry.requireRoles.includes(userRole)) {
      TraceLogger.warn("GATEWAY", "FORBIDDEN_ROLE", traceId, `用户角色 ${userRole} 无权访问 ${entry.label}`, c.get("userId"));
      return applyCors(c, ApiRes.forbidden("权限不足", traceId));
    }
    
    const svc = (c.env as any)[entry.target] as Fetcher | undefined;
    return await forwardToInternalSvc(c, svc!, entry.label);
  });
}

// ─── 404 ───

// ══════════════════════════════════════════════════
// 健康检查 — 用于网关 / 负载均衡存活探针
// ══════════════════════════════════════════════════
app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "gateway", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  const traceId = c.get("traceId");
  return applyCors(c, ApiRes.notFound("请求的接口不存在", traceId || "SYSTEM"));
});

// ─── 全局未知错误处理 ───
app.onError(async (err, c) => {
  const traceId = c.get("traceId") || crypto.randomUUID();
  TraceLogger.error("GATEWAY", "UNCAUGHT_EXCEPTION", traceId, `网关未捕获异常: getErrorMessage(err)`, err);
  return applyCors(c, ApiRes.internalError("网关未知异常，请联系系统管理员", traceId || "SYSTEM"));
});

// ══════════════════════════════════════════════════
// 辅助函数
// ══════════════════════════════════════════════════

/** 注入 CORS 响应头 */
function applyCors(c: Context, response: Response): Response {
  const allowedOrigin = c.env.ALLOWED_ORIGIN || "*";
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
  const traceId = c.get("traceId");
  if (traceId) {
    newHeaders.set("X-Trace-Id", traceId);
    newHeaders.set("Access-Control-Expose-Headers", "X-Trace-Id");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
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
  const userRole = c.get("userRole");

  if (!svcFetcher || typeof svcFetcher.fetch !== "function") {
    TraceLogger.error("GATEWAY", "SERVICE_BINDING_MISSING", traceId, `微服务转发失败: 未检测到 ${svcName} 资源绑定`);
    return applyCors(c, ApiRes.serviceUnavailable("系统服务暂不可用，请稍后再试", traceId));
  }

  // 1. 克隆与构造 Headers，注入内部签名与 Trace 元数据
  const internalHeaders = new Headers(c.req.raw.headers);
  internalHeaders.set("X-Internal-Key", c.env.INTERNAL_SECRET);
  internalHeaders.set("X-Trace-Id", traceId);
  
  if (userId) {
    internalHeaders.set("X-User-Id", userId);
  }
  if (userRole) {
    internalHeaders.set("X-User-Role", userRole);
  }

  let body: ReadableStream<Uint8Array> | null = null;
  const method = c.req.method;
  
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = c.req.raw.clone().body;
    } catch {
      // 容错
    }
  }

  const internalReq = new Request(c.req.url, {
    method,
    headers: internalHeaders,
    body,
    redirect: "manual"
  });

  // 2. 熔断器检测 (Circuit Breaker)
  const cb = new CircuitBreaker(c.env.CACHE_KV, svcName, traceId);
  if (!await cb.allowRequest()) {
    const status = await cb.getStatus();
    TraceLogger.warn("GATEWAY", "CIRCUIT_OPEN", traceId, `${svcName} 熔断器已开启 (连续失败 ${status.failureCount} 次)`, userId);
    return applyCors(c, ApiRes.serviceUnavailable(`${svcName} 暂时不可用，请稍后重试`, traceId));
  }

  const FORWARD_TIMEOUT_MS = 25000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
    try {
      const response = await svcFetcher.fetch(internalReq, { signal: controller.signal });
      // 成功 → 重置熔断器
      await cb.onSuccess();
      return applyCors(c, response);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (svcError: unknown) {
    const isTimeout = svcError instanceof Error && svcError.name === 'AbortError';
    TraceLogger.error("GATEWAY", isTimeout ? "SERVICE_FORWARD_TIMEOUT" : "SERVICE_FORWARD_ERROR", traceId,
      `${svcName} ${isTimeout ? "响应超时" : "内部通信故障"}: ${svcError instanceof Error ? svcError.message : String(svcError)}`, svcError, userId);
    // 失败 → 计入熔断器
    await cb.onFailure();
    return applyCors(c, ApiRes.serviceUnavailable("内部业务服务超时，请稍后重试", traceId));
  }
}

export default app;
