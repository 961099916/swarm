// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { ApiRes, TraceLogger, startupSecurityCheck, getErrorMessage } from "@swarm/kernel";
import { QuizRepository } from "./repositories/quiz.repository";
import { QuizService } from "./services/quiz.service";
import { QuizController } from "./controllers/quiz.controller";

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  INTERNAL_SECRET: string;
}

interface QuizVariables {
  traceId: string;
  userId: string;
}

const app = new Hono<{ Bindings: Env; Variables: QuizVariables }>();

// ══════════════════════════════════════════════════
// 中间件与请求日志
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
  TraceLogger.info("QUIZ", "REQUEST_INBOUND", traceId, `Quiz Worker 接收内部请求: ${c.req.method} ${c.req.path}`, userId, {
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
  TraceLogger.info("QUIZ", "REQUEST_OUTBOUND", traceId, `Quiz Worker 完成请求响应: ${c.req.method} ${c.req.path} -> [${status}] (${durationMs}ms)`, userId, {
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
    TraceLogger.warn("QUIZ", "UNAUTHORIZED_BYPASS", traceId, `安全拦截：非法客户端绕过网关直接请求评测服务`);
    return c.json({ code: 401, message: "Unauthorized", traceId }, 401);
  }

  const userId = c.req.header("X-User-Id");
  if (!userId) {
    return c.json({ code: 403, message: "Missing user metadata", traceId }, 403);
  }
  c.set("userId", userId);

  await handleInboundLog(c, traceId, userId);
  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;
  await handleOutboundLog(c, traceId, userId, durationMs);
});

// ══════════════════════════════════════════════════
// 控制器工厂辅助方法
// ══════════════════════════════════════════════════

function getController(c: Context): QuizController {
  const repo = new QuizRepository(c.env.DB);
  const svc = new QuizService(repo);
  return new QuizController(svc);
}

// ══════════════════════════════════════════════════
// 路由映射
// ══════════════════════════════════════════════════

app.get("/api/v1/quiz/map-config", async (c) => {
  return await getController(c).getMapConfig(c.req.raw, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/quiz/stages/status", async (c) => {
  return await getController(c).getStageStatus(c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/quiz/stages/:stageId/npcs/:npcId/questions", async (c) => {
  return await getController(c).getQuestions(c.req.raw, c.req.param("stageId"), c.req.param("npcId"), c.get("traceId"));
});

app.post("/api/v1/quiz/stages/:stageId/npcs/:npcId/submit", async (c) => {
  return await getController(c).submitAnswers(c.req.raw, c.req.param("stageId"), c.req.param("npcId"), c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/quiz/test-history", async (c) => {
  return await getController(c).getTestHistory(c.req.raw, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/quiz/test-history/:id", async (c) => {
  return await getController(c).getTestHistoryRecord(c.get("userId"), c.req.param("id"), c.get("traceId"));
});

app.delete("/api/v1/quiz/test-history/:id", async (c) => {
  return await getController(c).deleteTestHistory(c.req.param("id"), c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/quiz/calculate", async (c) => {
  return await getController(c).calculateQuiz(c.req.raw, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "quiz", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  const traceId = c.get("traceId");
  return c.json(ApiRes.notFound("请求的接口不存在", traceId || "SYSTEM"), 404);
});

app.onError(async (err, c) => {
  const traceId = c.get("traceId") || crypto.randomUUID();
  TraceLogger.error("QUIZ", "UNCAUGHT_EXCEPTION", traceId, `服务未捕获异常: ${getErrorMessage(err)}`, err, c.get("userId"));
  return c.json(ApiRes.internalError("系统繁忙，请稍后再试", traceId), 500);
});

export default app;
