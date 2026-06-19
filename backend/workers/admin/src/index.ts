import { ApiRes, TraceLogger, startupSecurityCheck } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import {
  handleAdminStats,
  handleAdminUsers,
  handleUpdateUserRole,
  handleAdjustUserCredits,
  handleInvalidateUserToken,
  handleBanUser,
  handleAdminTasks,
  handleCancelTask,
  handleAdminListAgents,
  handleAdminUpdateAgent,
  handleAdminDeleteAgent,
  handleAdminListTools,
  handleAdminCreateTool,
  handleAdminUpdateTool,
  handleAdminDeleteTool,
  handleAdminDebugTool,
  handleAdminListAuditLogs,
} from "./handlers/admin";
import {
  handleListModelConfigs,
  handleUpdateModelConfig,
  handleListAICallLogs,
  handleAIStats,
  handleAdminListKBs,
} from "./handlers/ai-gateway";

// ─── 环境变量类型 ───

export interface Env {
  DB: D1Database;
  CACHE_KV: any;
  INTERNAL_SECRET: string;
  /**
   * 防腐层 (Anti-Corruption Layer)
   * 通过 Service Binding 调用其他领域服务的内部 API，
   * 不再直接查询对方的数据表。
   */
  RAG_SVC?: Fetcher;  // 知识库领域 — 通过 RAG Worker 获取数据
}

// ─── Hono 上下文变量 ───

interface AdminVariables {
  traceId: string;
  adminId: string;
}

const app = new Hono<{ Bindings: Env; Variables: AdminVariables }>();

// ══════════════════════════════════════════════════
// 中间件
// ══════════════════════════════════════════════════

/** 统一 TraceID、物理安全验证与请求/响应日志 */
app.use("*", async (c: Context, next: Next) => {
  const traceId = c.req.header("X-Trace-Id") || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("X-Trace-Id", traceId);

  // 1. 启动 Fail-Fast 安全健康预检，确保核心内网密钥未遗漏
  const checkError = await startupSecurityCheck(c.env, traceId, ["INTERNAL_SECRET"]);
  if (checkError) return checkError;

  // 2. 验证内网通信签名
  const internalKey = c.req.header("X-Internal-Key");
  if (!internalKey || internalKey !== c.env.INTERNAL_SECRET) {
    TraceLogger.warn("ADMIN", "UNAUTHORIZED_BYPASS", traceId, `越权拦截：检测到非法的 Admin Worker 直连请求`);
    return c.json(ApiRes.unauthorized("无权访问", traceId), 401);
  }

  // 3. 验证管理员角色身份
  const userId = c.req.header("X-User-Id");
  const userRole = c.req.header("X-User-Role");
  if (!userId || userRole !== "ADMIN") {
    TraceLogger.warn("ADMIN", "ROLE_INSUFFICIENT", traceId, `越权拦截：用户角色为 ${userRole} 企图访问 Admin Worker`, userId);
    return c.json(ApiRes.forbidden("权限不足：非管理员无法访问内网管理服务", traceId), 403);
  }

  c.set("adminId", userId);

  // 4. 抓取请求参数
  let query = c.req.query();
  let requestBody: any = null;
  const contentType = c.req.header("Content-Type") || "";
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && contentType.includes("application/json")) {
    try {
      const clonedReq = c.req.raw.clone();
      requestBody = await clonedReq.json();
    } catch (err) {
      // 容错
    }
  }

  TraceLogger.info("ADMIN", "REQUEST_INBOUND", traceId, `Admin Worker 接收内部请求: ${c.req.method} ${c.req.path}`, userId, {
    query,
    body: requestBody
  });

  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;

  // 5. 抓取响应参数
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

  TraceLogger.info("ADMIN", "REQUEST_OUTBOUND", traceId, `Admin Worker 完成请求响应: ${c.req.method} ${c.req.path} -> [${status}] (${durationMs}ms)`, userId, {
    status,
    durationMs,
    response: responseBody
  });
});

// ══════════════════════════════════════════════════
// 路由
// ══════════════════════════════════════════════════

// 看板统计
app.get("/api/v1/admin/stats", async (c) => {
  return handleAdminStats(c.env.DB, c.get("traceId"));
});

// 用户列表
app.get("/api/v1/admin/users", async (c) => {
  return handleAdminUsers(c.req.raw, c.env.DB, c.get("traceId"));
});

// 全局任务列表
app.get("/api/v1/admin/tasks", async (c) => {
  return handleAdminTasks(c.req.raw, c.env.DB, c.get("traceId"));
});

// 智能体管理
app.get("/api/v1/admin/agents", async (c) => {
  return handleAdminListAgents(c.req.raw, c.env.DB, c.get("traceId"));
});

app.put("/api/v1/admin/agents/update", async (c) => {
  return handleAdminUpdateAgent(c.get("adminId"), c.req.raw, c.env.DB, c.get("traceId"));
});

app.delete("/api/v1/admin/agents/delete", async (c) => {
  return handleAdminDeleteAgent(c.get("adminId"), c.req.raw, c.env.DB, c.get("traceId"));
});

// 工具管理
app.get("/api/v1/admin/tools", async (c) => {
  return handleAdminListTools(c.env.DB, c.get("traceId"));
});

app.post("/api/v1/admin/tools/create", async (c) => {
  return handleAdminCreateTool(c.get("adminId"), c.req.raw, c.env.DB, c.get("traceId"));
});

app.put("/api/v1/admin/tools/update", async (c) => {
  return handleAdminUpdateTool(c.get("adminId"), c.req.raw, c.env.DB, c.get("traceId"));
});

app.delete("/api/v1/admin/tools/delete", async (c) => {
  return handleAdminDeleteTool(c.get("adminId"), c.req.raw, c.env.DB, c.get("traceId"));
});

app.post("/api/v1/admin/tools/debug", async (c) => {
  return handleAdminDebugTool(c.get("adminId"), c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/audit-logs", async (c) => {
  return handleAdminListAuditLogs(c.req.raw, c.env.DB, c.get("traceId"));
});

// ─── AI Gateway 管理 ───
app.get("/api/v1/admin/ai/models", async (c) => {
  return handleListModelConfigs(c.env.DB, c.get("traceId"));
});

app.put("/api/v1/admin/ai/models/update", async (c) => {
  return handleUpdateModelConfig(c.env.DB, c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/ai/logs", async (c) => {
  return handleListAICallLogs(c.env.DB, c.req.raw, c.get("traceId"));
});

app.get("/api/v1/admin/ai/stats", async (c) => {
  return handleAIStats(c.env.DB, c.get("traceId"));
});

// ─── 知识库管理 ───
app.get("/api/v1/admin/knowledge-bases", async (c) => {
  return handleAdminListKBs(c.env.DB, c.get("traceId"), c.env.RAG_SVC, c.get("adminId"));
});

// ─── 动态路由（通过 Hono 的 param 提取，替代原生正则匹配）───

app.put("/api/v1/admin/users/:id/role", async (c) => {
  return handleUpdateUserRole(c.get("adminId"), c.req.param("id"), c.req.raw, c.env.DB, c.env.CACHE_KV, c.get("traceId"));
});

app.put("/api/v1/admin/users/:id/credits", async (c) => {
  return handleAdjustUserCredits(c.get("adminId"), c.req.param("id"), c.req.raw, c.env.DB, c.get("traceId"));
});

app.post("/api/v1/admin/users/:id/invalidate", async (c) => {
  return handleInvalidateUserToken(c.get("adminId"), c.req.param("id"), c.env.DB, c.env.CACHE_KV, c.get("traceId"));
});

app.post("/api/v1/admin/users/:id/ban", async (c) => {
  return handleBanUser(c.get("adminId"), c.req.param("id"), c.req.raw, c.env.DB, c.env.CACHE_KV, c.get("traceId"));
});

app.put("/api/v1/admin/tasks/:id/cancel", async (c) => {
  return handleCancelTask(c.get("adminId"), c.req.param("id"), c.env.DB, c.get("traceId"));
});

// ─── 404 ───

// ══════════════════════════════════════════════════
// 健康检查 — 用于网关 / 负载均衡存活探针
// ══════════════════════════════════════════════════
app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "admin", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  const traceId = c.get("traceId");
  return c.json(ApiRes.notFound(`管理端未定义该内部路径: ${c.req.method} ${c.req.path}`, traceId), 404);
});

// ─── 全局错误处理 ───

app.onError(async (err, c) => {
  const traceId = c.get("traceId") || crypto.randomUUID();
  TraceLogger.error("ADMIN", "CORE_CRASH", traceId, `Admin Worker 核心逻辑崩溃: getErrorMessage(err)`, err);
  return c.json(ApiRes.internalError("内网管理服务异常，请联系系统管理员", traceId), 500);
});

export default app;
