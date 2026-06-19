// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { authenticateRequest } from "./authMiddleware";
import { TraceLogger, startupSecurityCheck } from "@swarm/shared";
import { ResponseBuilder } from "./utils/response";

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
  let query: any = null;
  let requestBody: any = null;
  if (!isAvatar) {
    query = c.req.query();
    const contentType = c.req.header("Content-Type") || "";
    if (c.req.method !== "GET" && c.req.method !== "HEAD" && contentType.includes("application/json")) {
      try {
        const clonedReq = c.req.raw.clone();
        requestBody = await clonedReq.json();
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
    let responseBody: any = null;
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

/** CORS 跨域处理 */
app.use("*", async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    const allowedOrigin = c.env.ALLOWED_ORIGIN || "*";
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

// ══════════════════════════════════════════════════
// 路由分发 (Service Bindings 反向代理)
// ══════════════════════════════════════════════════

// 1. 头像托管资源路由 (转发至 CORE_SVC)
app.all("/avatars/*", async (c) => {
  return await forwardToInternalSvc(c, c.env.CORE_SVC, "CORE_SVC (User Center)");
});

// 2. 微信登录接口 (免鉴权转发)
app.post("/api/v1/auth/login", async (c) => {
  return await forwardToInternalSvc(c, c.env.CORE_SVC, "CORE_SVC (User Center)");
});

// 3. 用户与资产相关接口 (转发至 CORE_SVC)
const userPaths = [
  "/api/v1/auth/logout",
  "/api/v1/user/profile",
  "/api/v1/user/avatar",
  "/api/v1/credits/bind-invite",
  "/api/v1/credits/reward",
  "/api/v1/credits/history"
];
for (const path of userPaths) {
  app.all(path, async (c) => {
    return await forwardToInternalSvc(c, c.env.CORE_SVC, "CORE_SVC (User Center)");
  });
}

// 4. 智能体与任务相关接口 (转发至 ENGINE_SVC)
const enginePaths = [
  "/api/v1/agents/list",
  "/api/v1/agents/create",
  "/api/v1/agents/update",
  "/api/v1/agents/delete",
  "/api/v1/tasks/create",
  "/api/v1/tasks/list",
  "/api/v1/tasks/logs"
];
for (const path of enginePaths) {
  app.all(path, async (c) => {
    return await forwardToInternalSvc(c, c.env.ENGINE_SVC, "ENGINE_SVC (Agent Engine)");
  });
}

// 5. 管理端接口转发 (转发至 ADMIN_SVC，网关层前置拦截非 ADMIN 角色)
app.all("/api/v1/admin/*", async (c) => {
  const userRole = c.get("userRole");
  const traceId = c.get("traceId");

  if (userRole !== "ADMIN") {
    TraceLogger.warn("GATEWAY", "FORBIDDEN_ADMIN_ACCESS", traceId, `非 ADMIN 用户尝试访问管理后台被网关拦截`, c.get("userId"));
    return applyCors(c, ResponseBuilder.forbidden("权限不足：您无权执行管理员操作", traceId));
  }

  return await forwardToInternalSvc(c, c.env.ADMIN_SVC, "ADMIN_SVC (Admin Center)");
});

// 6. 评测系统接口转发 (转发至 QUIZ_SVC)
app.all("/api/v1/quiz/*", async (c) => {
  return await forwardToInternalSvc(c, c.env.QUIZ_SVC, "QUIZ_SVC (Quiz System)");
});

// 7. RAG 知识库接口转发 (转发至 RAG_SVC)
app.all("/api/v1/kb/*", async (c) => {
  return await forwardToInternalSvc(c, c.env.RAG_SVC, "RAG_SVC (Knowledge Base)");
});

// ─── 404 ───
app.notFound(async (c) => {
  const traceId = c.get("traceId");
  return applyCors(c, ResponseBuilder.error("请求的接口不存在", traceId, 404));
});

// ─── 全局未知错误处理 ───
app.onError(async (err, c) => {
  const traceId = c.get("traceId") || crypto.randomUUID();
  TraceLogger.error("GATEWAY", "UNCAUGHT_EXCEPTION", traceId, `网关未捕获异常: ${err.message || err}`, err);
  return applyCors(c, ResponseBuilder.internalError("网关未知异常，请联系系统管理员", traceId));
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
 * Service Binding 高效转发函数，无任何网络 IO 开销
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
    return applyCors(c, ResponseBuilder.error(`系统服务暂不可用，请稍后再试`, traceId, 503));
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
  
  // 仅在非 GET/HEAD 场景下转发 Request Body 流
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = c.req.raw.clone().body;
    } catch {
      // 容错防 crash
    }
  }

  const internalReq = new Request(c.req.url, {
    method,
    headers: internalHeaders,
    body,
    redirect: "manual"
  });

  try {
    const response = await svcFetcher.fetch(internalReq);
    return applyCors(c, response);
  } catch (svcError: any) {
    TraceLogger.error("GATEWAY", "SERVICE_FORWARD_ERROR", traceId, `${svcName} 内部通信故障: ${svcError.message || svcError}`, svcError, userId);
    return applyCors(c, ResponseBuilder.error(`内部业务服务超时，请稍后重试`, traceId, 503));
  }
}

export default app;
