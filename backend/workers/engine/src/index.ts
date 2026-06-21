import { TraceLogger, startupSecurityCheck, getErrorMessage, handleGlobalError } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { AgentRepository } from "./repositories/agent.repository";
import { AgentService } from "./services/agent.service";
import { AgentController } from "./controllers/agent.controller";
import { TaskRepository } from "./repositories/task.repository";
import { TaskService, WorkflowInstance } from "./services/task.service";
import { TaskController } from "./controllers/task.controller";
import { ResponseBuilder } from "./utils/response";

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  TASK_WORKFLOW: WorkflowInstance;
  TASK_QUEUE: Queue;
  // Secrets
  INTERNAL_SECRET: string;
}

interface EngineVariables {
  traceId: string;
  userId: string;
  userRole: string;
}

const app = new Hono<{ Bindings: Env; Variables: EngineVariables }>();

// ══════════════════════════════════════════════════
// 中间件与安全拦截
// ══════════════════════════════════════════════════

app.use("*", async (c: Context, next: Next) => {
  const traceId = c.req.header("X-Trace-Id") || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("X-Trace-Id", traceId);

  // 1. 启动 Fail-Fast 安全健康预检，确保必需密钥在部署时未遗漏
  const checkError = await startupSecurityCheck(c.env, traceId, ["INTERNAL_SECRET"]);
  if (checkError) return checkError;

  // 2. 内部通信签名校验，强力阻断恶意越权绕过网关
  const internalKey = c.req.header("X-Internal-Key");
  if (!internalKey || internalKey !== c.env.INTERNAL_SECRET) {
    TraceLogger.warn("ENGINE", "UNAUTHORIZED_BYPASS", traceId, `安全拦截：非法客户端绕过网关直接请求智能体引擎服务`);
    return c.json({ success: false, error: "Unauthorized access", traceId }, 401);
  }

  // 3. 解析绑定网关下发的用户身份与角色
  const userId = c.req.header("X-User-Id");
  const userRole = c.req.header("X-User-Role") || "FREE_USER";
  if (!userId) {
    TraceLogger.warn("ENGINE", "MISSING_IDENTITY", traceId, `安全拦截：网关请求未携带 X-User-Id 身份元数据`);
    return c.json({ success: false, error: "Missing identity metadata", traceId }, 400);
  }
  
  c.set("userId", userId);
  c.set("userRole", userRole);

  // 4. 抓取入参
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

  TraceLogger.info("ENGINE", "REQUEST_INBOUND", traceId, `Engine Worker 接收内部请求: ${c.req.method} ${c.req.path}`, userId, {
    query,
    body: requestBody
  });

  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;

  // 5. 抓取出参
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

  TraceLogger.info("ENGINE", "REQUEST_OUTBOUND", traceId, `Engine Worker 完成请求响应: ${c.req.method} ${c.req.path} -> [${status}] (${durationMs}ms)`, userId, {
    status,
    durationMs,
    response: responseBody
  });
});

// ─── 智能体业务路由 ───
app.get("/api/v1/agents/list", async (c) => {
  const agentRepo = new AgentRepository(c.env.DB);
  const agentSvc = new AgentService(agentRepo);
  const agentController = new AgentController(agentSvc);
  return await agentController.handleListAgents(c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/agents/create", async (c) => {
  const agentRepo = new AgentRepository(c.env.DB);
  const agentSvc = new AgentService(agentRepo);
  const agentController = new AgentController(agentSvc);
  return await agentController.handleCreateAgent(c.req.raw, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.put("/api/v1/agents/update", async (c) => {
  const agentRepo = new AgentRepository(c.env.DB);
  const agentSvc = new AgentService(agentRepo);
  const agentController = new AgentController(agentSvc);
  return await agentController.handleUpdateAgent(c.req.raw, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.delete("/api/v1/agents/delete", async (c) => {
  const agentRepo = new AgentRepository(c.env.DB);
  const agentSvc = new AgentService(agentRepo);
  const agentController = new AgentController(agentSvc);
  return await agentController.handleDeleteAgent(c.req.raw, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

// ─── 任务业务路由 ───
app.post("/api/v1/tasks/create", async (c) => {
  const taskRepo = new TaskRepository(c.env.DB);
  const taskSvc = new TaskService(taskRepo);
  const taskController = new TaskController(taskRepo, taskSvc);
  return await taskController.handleCreateTask(c.req.raw, c.env.DB, c.env.TASK_WORKFLOW, c.env.TASK_QUEUE, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/tasks/list", async (c) => {
  const taskRepo = new TaskRepository(c.env.DB);
  const taskSvc = new TaskService(taskRepo);
  const taskController = new TaskController(taskRepo, taskSvc);
  return await taskController.handleListTasks(c.req.raw, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/tasks/logs", async (c) => {
  const taskRepo = new TaskRepository(c.env.DB);
  const taskSvc = new TaskService(taskRepo);
  const taskController = new TaskController(taskRepo, taskSvc);
  return await taskController.handleTaskLogs(c.req.raw, c.get("userId"), c.get("userRole"), c.get("traceId"));
});

// ─── 404 ───

// ══════════════════════════════════════════════════
// 健康检查 — 用于网关 / 负载均衡存活探针
// ══════════════════════════════════════════════════
app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "engine", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  return ResponseBuilder.error("资源不存在", c.get("traceId") || crypto.randomUUID(), 404);
});

// ─── 全局未知错误拦截 ───
app.onError(async (err, c) => {
  return handleGlobalError(err, c, "ENGINE");
});

export default app;
