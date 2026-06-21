// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { ApiRes, TraceLogger, startupSecurityCheck, getErrorMessage, handleGlobalError } from "@swarm/kernel";
import { RagRepository } from "./repositories/rag.repository";
import { RagService } from "./services/rag.service";
import { RagController } from "./controllers/rag.controller";
import { DocumentProcessWorkflow } from "./processor/pipeline-workflow";

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  AI: any;
  AI_GATEWAY?: any;
  DOC_WORKFLOW?: any;
  DOC_QUEUE?: any;
}

interface RagVariables {
  traceId: string;
  userId: string;
  userRole: string;
}

const app = new Hono<{ Bindings: Env; Variables: RagVariables }>();

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
  TraceLogger.info("RAG", "REQUEST_INBOUND", traceId, `RAG Worker 接收请求: ${c.req.method} ${c.req.path}`, userId, {
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
  TraceLogger.info("RAG", "REQUEST_OUTBOUND", traceId, `RAG Worker 响应: ${c.req.method} ${c.req.path} -> ${status} (${durationMs}ms)`, userId, {
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

  const userId = c.req.header("X-User-Id");
  if (!userId) {
    TraceLogger.warn("RAG", "MISSING_IDENTITY", traceId, `RAG 请求未携带 X-User-Id`);
    return c.json({ success: false, error: "Missing identity metadata", traceId }, 400);
  }

  c.set("userId", userId);
  c.set("userRole", c.req.header("X-User-Role") || "FREE_USER");

  await handleInboundLog(c, traceId, userId);
  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;
  await handleOutboundLog(c, traceId, userId, durationMs);
});

// ══════════════════════════════════════════════════
// 控制器工厂辅助方法
// ══════════════════════════════════════════════════

function getController(c: Context): RagController {
  const repo = new RagRepository(c.env.DB);
  const svc = new RagService(repo);
  return new RagController(svc);
}

// ══════════════════════════════════════════════════
// 路由映射
// ══════════════════════════════════════════════════

app.get("/api/v1/kb/list", async (c) => {
  return await getController(c).getKBs(c.req.raw, c.get("userId"), c.get("userRole"), c.get("traceId"));
});

app.post("/api/v1/kb/create", async (c) => {
  return await getController(c).createKB(c.req.raw, c.get("userId"), c.get("traceId"));
});

app.put("/api/v1/kb/update", async (c) => {
  const url = new URL(c.req.url);
  const kbId = url.searchParams.get("kbId") || "";
  return await getController(c).updateKB(c.req.raw, kbId, c.get("userId"), c.get("userRole"), c.get("traceId"));
});

app.delete("/api/v1/kb/delete", async (c) => {
  const url = new URL(c.req.url);
  const kbId = url.searchParams.get("kbId") || "";
  return await getController(c).deleteKB(kbId, c.get("userId"), c.get("userRole"), c.get("traceId"));
});

app.post("/api/v1/kb/document/url", async (c) => {
  return await getController(c).addDocumentByUrl(c.req.raw, c.env.DOC_QUEUE, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/kb/document/manual", async (c) => {
  return await getController(c).addDocumentManual(c.req.raw, c.env.DOC_QUEUE, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/kb/document/list", async (c) => {
  const url = new URL(c.req.url);
  const kbId = url.searchParams.get("kbId") || "";
  return await getController(c).getDocuments(c.req.raw, kbId, c.get("userId"), c.get("traceId"));
});

app.delete("/api/v1/kb/document/delete", async (c) => {
  const url = new URL(c.req.url);
  const docId = url.searchParams.get("docId") || "";
  return await getController(c).deleteDocument(docId, c.get("userId"), c.get("userRole"), c.get("traceId"));
});

app.post("/api/v1/kb/search", async (c) => {
  return await getController(c).searchKnowledge(c.req.raw, c.env.DB, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/kb/chat", async (c) => {
  return await getController(c).chatKnowledge(c.req.raw, c.env.AI, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/rag/inject", async (c) => {
  return await getController(c).injectContext(c.req.raw, c.get("traceId"));
});

app.post("/api/v1/rag/admin/knowledge-bases", async (c) => {
  return await getController(c).getKBsDirect(c.get("traceId"));
});

// ══════════════════════════════════════════════════
// 内网管理专用接口 (受 INTERNAL_SECRET & X-User-Role 保护)
// ══════════════════════════════════════════════════

app.get("/api/v1/internal/admin/documents", async (c) => {
  return await getController(c).getGlobalDocuments(c.req.raw, c.get("traceId"));
});

app.delete("/api/v1/internal/admin/documents", async (c) => {
  const url = new URL(c.req.url);
  const docId = url.searchParams.get("docId") || "";
  return await getController(c).deleteDocument(docId, "system", "ADMIN", c.get("traceId"));
});

app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "rag", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  const traceId = c.get("traceId");
  return c.json(ApiRes.notFound("请求的接口不存在", traceId || "SYSTEM"), 404);
});

app.onError(async (err, c) => {
  return handleGlobalError(err, c, "RAG");
});

export { DocumentProcessWorkflow };

export default app;
