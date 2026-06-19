import { AIClient, AIClientEnv } from "@swarm/ai-gateway";
import { TraceLogger } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { ResponseBuilder } from "./utils/response";
import { handleListKBs, handleCreateKB, handleGetKB, handleDeleteKB, handleUpdateKB, handleAdminListKBs } from "./handlers/knowledge-bases";
import { handleAddDocument, handleListDocuments, handleDeleteDocument, handleAddDocumentManual } from "./handlers/documents";

import { handleSearchKnowledge } from "./handlers/search";
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
// 中间件
// ══════════════════════════════════════════════════

app.use("*", async (c: Context, next: Next) => {
  const traceId = c.req.header("X-Trace-Id") || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("X-Trace-Id", traceId);

  // 仅校验用户身份（由 Gateway 注入，无安全风险）
  const userId = c.req.header("X-User-Id");
  if (!userId) {
    TraceLogger.warn("RAG", "MISSING_IDENTITY", traceId, `RAG 请求未携带 X-User-Id`);
    return c.json({ success: false, error: "Missing identity metadata", traceId }, 400);
  }

  c.set("userId", userId);
  c.set("userRole", c.req.header("X-User-Role") || "FREE_USER");

  TraceLogger.info("RAG", "REQUEST_INBOUND", traceId, `RAG Worker 接收请求: ${c.req.method} ${c.req.path}`, userId);

  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;
  TraceLogger.info("RAG", "REQUEST_OUTBOUND", traceId, `RAG Worker 响应: ${c.req.method} ${c.req.path} -> ${c.res.status} (${durationMs}ms)`, userId);
});

// ══════════════════════════════════════════════════
// 知识库 CRUD
// ══════════════════════════════════════════════════

app.get("/api/v1/kb/list", async (c) => {
  return await handleListKBs(c.req.raw, c.env.DB, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/kb/create", async (c) => {
  return await handleCreateKB(c.req.raw, c.env.DB, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/kb/get", async (c) => {
  return await handleGetKB(c.req.raw, c.env.DB, c.get("userId"), c.get("traceId"));
});

app.put("/api/v1/kb/update", async (c) => {
  return await handleUpdateKB(c.req.raw, c.env.DB, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.delete("/api/v1/kb/delete", async (c) => {
  return await handleDeleteKB(c.req.raw, c.env.DB, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

// ══════════════════════════════════════════════════
// 文档管理
// ══════════════════════════════════════════════════

app.post("/api/v1/kb/document/url", async (c) => {
  return await handleAddDocument(c.req.raw, c.env, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/kb/document/manual", async (c) => {
  return await handleAddDocumentManual(c.req.raw, c.env, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/kb/document/list", async (c) => {
  return await handleListDocuments(c.req.raw, c.env.DB, c.get("userId"), c.get("traceId"));
});

app.delete("/api/v1/kb/document/delete", async (c) => {
  return await handleDeleteDocument(c.req.raw, c.env.DB, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

// ══════════════════════════════════════════════════
// 知识检索
// ══════════════════════════════════════════════════

app.post("/api/v1/kb/search", async (c) => {
  return await handleSearchKnowledge(c.req.raw, c.env, c.get("userId"), c.get("traceId"));
});

// RAG 上下文注入（供 Workflow/Agent 内部调用）
app.post("/api/v1/rag/inject", async (c) => {
  const { handleRAGContextInject } = await import("./handlers/search");
  return await handleRAGContextInject(c.req.raw, c.env, c.get("traceId"));
});

// 管理后台知识库列表（防腐层，Admin SVC 通过 Service Binding 调用）
app.post("/api/v1/rag/admin/knowledge-bases", async (c) => {
  return await handleAdminListKBs(c.env.DB, c.get("traceId"));
});

// ══════════════════════════════════════════════════
// 404 & Error
// ══════════════════════════════════════════════════

// ══════════════════════════════════════════════════
// 健康检查 — 用于网关 / 负载均衡存活探针
// ══════════════════════════════════════════════════
app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "rag", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  return ResponseBuilder.error("资源不存在", c.get("traceId") || crypto.randomUUID(), 404);
});

app.onError(async (err, c) => {
  const traceId = c.get("traceId") || crypto.randomUUID();
  TraceLogger.error("RAG", "UNCAUGHT_EXCEPTION", traceId, `RAG 服务未捕获异常: getErrorMessage(err)`, err);
  return ResponseBuilder.internalError("系统繁忙，请联系系统管理员", traceId);
});

export { DocumentProcessWorkflow };

export default app;
