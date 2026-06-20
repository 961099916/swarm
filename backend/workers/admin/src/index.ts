// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { ApiRes, TraceLogger, startupSecurityCheck, getErrorMessage } from "@swarm/kernel";
import { AdminRepository } from "./repositories/admin.repository";
import { AdminService } from "./services/admin.service";
import { AdminController } from "./controllers/admin.controller";

export interface Env {
  DB: D1Database;
  CACHE_KV: any;
  INTERNAL_SECRET: string;
  RAG_SVC?: Fetcher;
  QUIZ_SVC?: Fetcher;
}

interface AdminVariables {
  traceId: string;
  adminId: string;
}

const app = new Hono<{ Bindings: Env; Variables: AdminVariables }>();

// ══════════════════════════════════════════════════
// 中间件与可观测性
// ══════════════════════════════════════════════════

async function handleInboundLog(c: Context, traceId: string, userId: string) {
  let query = c.req.query();
  let requestBody: any = null;
  const contentType = c.req.header("Content-Type") || "";
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && contentType.includes("application/json")) {
    try {
      const clonedReq = c.req.raw.clone();
      requestBody = await clonedReq.json();
    } catch {}
  }
  TraceLogger.info("ADMIN", "REQUEST_INBOUND", traceId, `Admin Worker 接收内部请求: ${c.req.method} ${c.req.path}`, userId, {
    query,
    body: requestBody
  });
}

async function handleOutboundLog(c: Context, traceId: string, userId: string, durationMs: number) {
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
      } catch {}
    }
  }
  TraceLogger.info("ADMIN", "REQUEST_OUTBOUND", traceId, `Admin Worker 完成请求响应: ${c.req.method} ${c.req.path} -> [${status}] (${durationMs}ms)`, userId, {
    status,
    durationMs,
    response: responseBody
  });
}

app.use("*", async (c: Context, next: Next) => {
  const traceId = c.req.header("X-Trace-Id") || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("X-Trace-Id", traceId);

  const checkError = await startupSecurityCheck(c.env, traceId, ["INTERNAL_SECRET"]);
  if (checkError) return checkError;

  const internalKey = c.req.header("X-Internal-Key");
  if (!internalKey || internalKey !== c.env.INTERNAL_SECRET) {
    TraceLogger.warn("ADMIN", "UNAUTHORIZED_BYPASS", traceId, `越权拦截：检测到非法的 Admin Worker 直连请求`);
    return c.json(ApiRes.unauthorized("无权访问", traceId), 401);
  }

  const userId = c.req.header("X-User-Id");
  const userRole = c.req.header("X-User-Role");
  if (!userId || userRole !== "ADMIN") {
    TraceLogger.warn("ADMIN", "ROLE_INSUFFICIENT", traceId, `越权拦截：用户角色为 ${userRole} 企图访问 Admin Worker`, userId);
    return c.json(ApiRes.forbidden("权限不足：非管理员无法访问内网管理服务", traceId), 403);
  }

  c.set("adminId", userId);

  await handleInboundLog(c, traceId, userId);
  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;
  await handleOutboundLog(c, traceId, userId, durationMs);
});

// ══════════════════════════════════════════════════
// 控制器工厂辅助方法
// ══════════════════════════════════════════════════

function getController(c: Context): AdminController {
  const repo = new AdminRepository(c.env.DB);
  const svc = new AdminService(repo);
  return new AdminController(svc);
}

// ══════════════════════════════════════════════════
// 路由映射
// ══════════════════════════════════════════════════

app.get("/api/v1/admin/stats", async (c) => {
  return await getController(c).getStats(c.get("traceId"));
});

app.get("/api/v1/admin/users", async (c) => {
  return await getController(c).getUsers(c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/tasks", async (c) => {
  return await getController(c).getTasks(c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/agents", async (c) => {
  return await getController(c).getAgents(c.req.raw, c.get("traceId"));
});

app.put("/api/v1/admin/agents/update", async (c) => {
  return await getController(c).updateAgent(c.get("adminId"), c.req.raw, c.env.CACHE_KV, c.get("traceId"));
});

app.delete("/api/v1/admin/agents/delete", async (c) => {
  return await getController(c).deleteAgent(c.get("adminId"), c.req.raw, c.env.CACHE_KV, c.get("traceId"));
});

app.get("/api/v1/admin/tools", async (c) => {
  return await getController(c).listTools(c.get("traceId"));
});

app.post("/api/v1/admin/tools/create", async (c) => {
  return await getController(c).createTool(c.get("adminId"), c.req.raw, c.get("traceId"));
});

app.put("/api/v1/admin/tools/update", async (c) => {
  return await getController(c).updateTool(c.get("adminId"), c.req.raw, c.get("traceId"));
});

app.delete("/api/v1/admin/tools/delete", async (c) => {
  return await getController(c).deleteTool(c.get("adminId"), c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/audit-logs", async (c) => {
  return await getController(c).getAuditLogs(c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/ai/models", async (c) => {
  return await getController(c).listModelConfigs(c.get("traceId"));
});

app.put("/api/v1/admin/ai/models/update", async (c) => {
  return await getController(c).updateModelConfig(c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/ai/logs", async (c) => {
  return await getController(c).listAICallLogs(c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/ai/stats", async (c) => {
  return await getController(c).getAIStats(c.get("traceId"));
});

app.get("/api/v1/admin/knowledge-bases", async (c) => {
  return await getController(c).getKBs(c.req.raw, c.env.RAG_SVC, c.get("adminId"), c.get("traceId"));
});

app.put("/api/v1/admin/users/:id/role", async (c) => {
  return await getController(c).updateUserRole(c.get("adminId"), c.req.param("id"), c.req.raw, c.env.CACHE_KV, c.get("traceId"));
});

app.put("/api/v1/admin/users/:id/credits", async (c) => {
  return await getController(c).adjustUserCredits(c.get("adminId"), c.req.param("id"), c.req.raw, c.get("traceId"));
});

app.post("/api/v1/admin/users/:id/invalidate", async (c) => {
  return await getController(c).invalidateUserToken(c.get("adminId"), c.req.param("id"), c.env.CACHE_KV, c.get("traceId"));
});

app.post("/api/v1/admin/users/:id/ban", async (c) => {
  return await getController(c).banUser(c.get("adminId"), c.req.param("id"), c.req.raw, c.env.CACHE_KV, c.get("traceId"));
});

app.put("/api/v1/admin/tasks/:id/cancel", async (c) => {
  return await getController(c).cancelTask(c.get("adminId"), c.req.param("id"), c.get("traceId"));
});

app.get("/api/v1/admin/credits/ad-logs", async (c) => {
  return await getController(c).listAdRewardLogs(c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/credits/invitations", async (c) => {
  return await getController(c).listUserInvitations(c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/knowledge/documents", async (c) => {
  return await getController(c).getGlobalDocuments(c.req.raw, c.env.RAG_SVC, c.get("adminId"), c.get("traceId"));
});

app.delete("/api/v1/admin/knowledge/documents/delete", async (c) => {
  return await getController(c).deleteGlobalDocument(c.req.raw, c.env.RAG_SVC, c.get("adminId"), c.get("traceId"));
});

app.post("/api/v1/admin/quiz/users/reset", async (c) => {
  return await getController(c).resetUserQuizProgress(c.req.raw, c.env.QUIZ_SVC, c.get("adminId"), c.get("traceId"));
});

app.get("/api/v1/admin/quiz/configs", async (c) => {
  return await getController(c).getQuizConfigs(c.env.QUIZ_SVC, c.get("adminId"), c.get("traceId"));
});

app.put("/api/v1/admin/quiz/configs", async (c) => {
  return await getController(c).updateQuizConfigs(c.req.raw, c.env.QUIZ_SVC, c.get("adminId"), c.get("traceId"));
});

app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "admin", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  const traceId = c.get("traceId");
  return c.json(ApiRes.notFound(`管理端未定义该内部路径: ${c.req.method} ${c.req.path}`, traceId), 404);
});

app.onError(async (err, c) => {
  const traceId = c.get("traceId") || crypto.randomUUID();
  TraceLogger.error("ADMIN", "CORE_CRASH", traceId, `Admin Worker 核心逻辑崩溃: ${getErrorMessage(err)}`, err);
  return c.json(ApiRes.internalError("内网管理服务异常，请联系系统管理员", traceId), 500);
});

export default app;
