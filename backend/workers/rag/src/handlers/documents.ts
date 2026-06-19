// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/handlers/documents.ts

import { TraceLogger, CacheService, AddDocumentByUrlReq, AddDocumentManualReq, DocumentDTO, RAG_MAX_FILE_SIZE } from "@swarm/shared";
import { ResponseBuilder } from "../utils/response";

interface DocumentRow {
  id: string;
  kb_id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  raw_content: string;
  chunk_count: number;
  status: string;
  error_message: string | null;
  file_name: string | null;
  file_size: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapDocToDTO(row: DocumentRow): DocumentDTO {
  return {
    id: row.id,
    kbId: row.kb_id,
    title: row.title,
    sourceType: row.source_type as any,
    sourceUrl: row.source_url || undefined,
    chunkCount: row.chunk_count,
    status: row.status as any,
    errorMessage: row.error_message || undefined,
    fileName: row.file_name || undefined,
    fileSize: row.file_size || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 验证用户对知识库的访问权限
 */
async function verifyKBAccess(db: D1Database, kbId: string, userId: string): Promise<boolean> {
  const { results } = await db
    .prepare("SELECT id FROM knowledge_bases WHERE id = ? AND (user_id = ? OR is_public = 1)")
    .bind(kbId, userId)
    .all();
  return results && results.length > 0;
}

/**
 * 通过 URL 添加文档 (POST /api/v1/kb/document/url)
 */
export async function handleAddDocument(
  request: Request,
  env: { DB: D1Database; CACHE_KV: KVNamespace; AI: any; DOC_WORKFLOW?: any },
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as AddDocumentByUrlReq;
    if (!body.kbId || !body.url) {
      return ResponseBuilder.badRequest("缺少必填参数 kbId 或 url", traceId);
    }

    // URL 基本校验：仅检查非空，具体有效性由 fetch 时验证
    let finalUrl = body.url.trim();
    if (!finalUrl) {
      return ResponseBuilder.badRequest("URL 不能为空", traceId);
    }
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    const hasAccess = await verifyKBAccess(env.DB, body.kbId, userId);
    if (!hasAccess) {
      return ResponseBuilder.forbidden("知识库不存在或您无权操作", traceId);
    }

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 先插入文档记录（status=PENDING）
    await env.DB
      .prepare(
        `INSERT INTO documents (id, kb_id, title, source_type, source_url, raw_content, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'WEB_SCRAPE', ?, '', 'PENDING', ?, ?, ?)`
      )
      .bind(docId, body.kbId, body.title || finalUrl, finalUrl, userId, now, now)
      .run();

    TraceLogger.info("RAG", "DOCUMENT_SUBMITTED", traceId, `文档已提交，发送到处理队列: docId=${docId}`, userId);

    // 发送到文档处理队列（异步解耦）
    try {
      const queue = (env as any).DOC_QUEUE;
      if (queue && typeof queue.send === "function") {
        await queue.send({
          docId,
          kbId: body.kbId,
          sourceType: 'WEB_SCRAPE',
          sourceUrl: finalUrl,
        });
        TraceLogger.info("RAG", "DOC_ENQUEUED", traceId, `文档消息已入队: docId=${docId}`, userId);
      } else {
        TraceLogger.warn("RAG", "DOC_QUEUE_NOT_BOUND", traceId, `DOC_QUEUE 未绑定，文档 ${docId} 停留在 PENDING`);
      }
    } catch (qErr: any) {
      TraceLogger.error("RAG", "DOC_ENQUEUE_FAILED", traceId, `文档入队失败: ${qErr.message}`, qErr);
    }

    return ResponseBuilder.success({
      docId,
      message: "文档已提交，后台正在处理中",
    }, traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "ADD_DOCUMENT_FAILED", traceId, `添加文档异常: ${error.message}`, error);
    return ResponseBuilder.internalError("添加文档失败", traceId);
  }
}

/**
 * 手动录入文档 (POST /api/v1/kb/document/manual)
 */
export async function handleAddDocumentManual(
  request: Request,
  env: { DB: D1Database; CACHE_KV: KVNamespace; AI: any; DOC_WORKFLOW?: any },
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as AddDocumentManualReq;
    if (!body.kbId || !body.title || !body.content) {
      return ResponseBuilder.badRequest("缺少必填参数 kbId、title 或 content", traceId);
    }

    const hasAccess = await verifyKBAccess(env.DB, body.kbId, userId);
    if (!hasAccess) {
      return ResponseBuilder.forbidden("知识库不存在或您无权操作", traceId);
    }

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 手动录入直接插入原始内容，状态为 PENDING（后续走分块+嵌入流程）
    await env.DB
      .prepare(
        `INSERT INTO documents (id, kb_id, title, source_type, raw_content, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 'MANUAL', ?, 'PENDING', ?, ?, ?)`
      )
      .bind(docId, body.kbId, body.title.trim(), body.content, userId, now, now)
      .run();

    // 发送到文档处理队列
    try {
      const queue = (env as any).DOC_QUEUE;
      if (queue && typeof queue.send === "function") {
        await queue.send({
          docId,
          kbId: body.kbId,
          sourceType: 'MANUAL',
          rawContent: body.content,
        });
        TraceLogger.info("RAG", "MANUAL_DOC_ENQUEUED", traceId, `手动文档消息已入队: docId=${docId}`, userId);
      } else {
        TraceLogger.warn("RAG", "DOC_QUEUE_NOT_BOUND", traceId, `DOC_QUEUE 未绑定`);
      }
    } catch (qErr: any) {
      TraceLogger.error("RAG", "MANUAL_DOC_ENQUEUE_FAILED", traceId, `手动文档入队失败: ${qErr.message}`, qErr);
    }

    TraceLogger.info("RAG", "MANUAL_DOC_PENDING", traceId, `手动文档已提交: docId=${docId}`, userId);

    return ResponseBuilder.success({ docId, message: "文档已提交，后台正在处理中" }, traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "ADD_MANUAL_DOC_FAILED", traceId, `手动录入文档异常: ${error.message}`, error);
    return ResponseBuilder.internalError("添加文档失败", traceId);
  }
}

/**
 * 获取文档列表 (GET /api/v1/kb/document/list?kbId=xxx)
 */
export async function handleListDocuments(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const kbId = url.searchParams.get("kbId");
    if (!kbId) return ResponseBuilder.badRequest("缺少 kbId 参数", traceId);

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50")));
    const offset = (page - 1) * pageSize;

    const hasAccess = await verifyKBAccess(db, kbId, userId);
    if (!hasAccess) {
      return ResponseBuilder.forbidden("知识库不存在或您无权访问", traceId);
    }

    const countResult = await db
      .prepare("SELECT COUNT(*) as total FROM documents WHERE kb_id = ?")
      .bind(kbId)
      .first<any>();
    const total = countResult?.total || 0;

    const { results } = await db
      .prepare("SELECT * FROM documents WHERE kb_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .bind(kbId, pageSize, offset)
      .all<any>();

    return ResponseBuilder.success({
      list: (results || []).map(mapDocToDTO),
      total,
      page,
      pageSize,
    }, traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "LIST_DOCS_FAILED", traceId, `获取文档列表异常: ${error.message}`, error);
    return ResponseBuilder.internalError("获取文档列表失败", traceId);
  }
}

/**
 * 删除文档 (DELETE /api/v1/kb/document/delete?docId=xxx)
 */
export async function handleDeleteDocument(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const docId = url.searchParams.get("docId");
    if (!docId) return ResponseBuilder.badRequest("缺少 docId 参数", traceId);

    // 查询文档所属知识库，校验权限
    const { results } = await db
      .prepare(
        `SELECT d.kb_id, d.chunk_count FROM documents d
         JOIN knowledge_bases kb ON kb.id = d.kb_id
         WHERE d.id = ? AND kb.user_id = ?`
      )
      .bind(docId, userId)
      .all<any>();

    if (!results || results.length === 0) {
      return ResponseBuilder.forbidden("文档不存在或您无权删除", traceId);
    }

    const doc = results[0];

    // 删除文档（CASCADE 会自动删除 document_chunks）
    await db.prepare("DELETE FROM documents WHERE id = ?").bind(docId).run();

    // 清除该知识库的 KV 缓存
    await CacheService.delete(kv, `rag:kbs:list:${userId}`);

    TraceLogger.info("RAG", "DELETE_DOC_SUCCESS", traceId, `删除文档成功: docId=${docId}`, userId);
    return ResponseBuilder.success({ success: true }, traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "DELETE_DOC_FAILED", traceId, `删除文档异常: ${error.message}`, error);
    return ResponseBuilder.internalError("删除文档失败", traceId);
  }
}
