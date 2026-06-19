// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/handlers/knowledge-bases.ts

import { KnowledgeBaseDTO, CreateKnowledgeBaseReq, TraceLogger, CacheService } from "@swarm/shared";
import { ResponseBuilder } from "../utils/response";

interface KnowledgeBaseRow {
  id: string;
  name: string;
  description: string | null;
  user_id: string | null;
  is_public: number;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  created_at: string;
  updated_at: string;
}

function mapKBToDTO(row: KnowledgeBaseRow, docCount: number): KnowledgeBaseDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    userId: row.user_id || undefined,
    isPublic: row.is_public === 1,
    embeddingModel: row.embedding_model,
    chunkSize: row.chunk_size,
    chunkOverlap: row.chunk_overlap,
    documentCount: docCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 获取知识库列表 (GET /api/v1/kb/list)
 * 支持分页和搜索：?page=1&pageSize=20&search=关键词
 */
export async function handleListKBs(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20")));
    const search = (url.searchParams.get("search") || "").trim();

    const cacheKey = `rag:kbs:list:${userId}:${page}:${pageSize}:${search}`;
    const cached = await CacheService.get<{ list: KnowledgeBaseDTO[]; total: number }>(kv, cacheKey);
    if (cached !== undefined) {
      return ResponseBuilder.success(cached, traceId);
    }

    const offset = (page - 1) * pageSize;
    let whereClause = "WHERE (kb.user_id = ? OR kb.is_public = 1)";
    const params: any[] = [userId];

    if (search) {
      whereClause += " AND (kb.name LIKE ? OR kb.description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    // 查询总数
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM knowledge_bases kb ${whereClause}`)
      .bind(...params)
      .first<any>();
    const total = countResult?.total || 0;

    // 查询分页数据
    const { results } = await db
      .prepare(
        `SELECT kb.*,
          (SELECT COUNT(*) FROM documents d WHERE d.kb_id = kb.id) as doc_count
         FROM knowledge_bases kb
         ${whereClause}
         ORDER BY kb.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, pageSize, offset)
      .all<any>();

    const dtoList = (results || []).map((r: any) => mapKBToDTO(r, r.doc_count || 0));
    const result = { list: dtoList, total, page, pageSize };
    await CacheService.set(kv, cacheKey, result, 7200);

    return ResponseBuilder.success(result, traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "LIST_KB_FAILED", traceId, `获取知识库列表异常: ${error.message}`, error);
    return ResponseBuilder.internalError("获取知识库列表失败", traceId);
  }
}

/**
 * 创建知识库 (POST /api/v1/kb/create)
 */
export async function handleCreateKB(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as CreateKnowledgeBaseReq;
    if (!body.name || body.name.trim().length === 0) {
      return ResponseBuilder.badRequest("知识库名称不能为空", traceId);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO knowledge_bases (id, name, description, user_id, is_public, chunk_size, chunk_overlap, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        body.name.trim(),
        body.description?.trim() || null,
        userId,
        body.isPublic ? 1 : 0,
        body.chunkSize || 500,
        body.chunkOverlap || 100,
        now,
        now
      )
      .run();

    await CacheService.delete(kv, `rag:kbs:list:${userId}`);

    TraceLogger.info("RAG", "CREATE_KB_SUCCESS", traceId, `创建知识库成功: kbId=${id}`, userId);
    return ResponseBuilder.success({ kbId: id }, traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "CREATE_KB_FAILED", traceId, `创建知识库异常: ${error.message}`, error);
    return ResponseBuilder.internalError("创建知识库失败", traceId);
  }
}

/**
 * 获取单个知识库 (GET /api/v1/kb/get?kbId=xxx)
 */
export async function handleGetKB(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const kbId = url.searchParams.get("kbId");
    if (!kbId) return ResponseBuilder.badRequest("缺少 kbId 参数", traceId);

    const { results } = await db
      .prepare(
        `SELECT kb.*,
          (SELECT COUNT(*) FROM documents d WHERE d.kb_id = kb.id) as doc_count
         FROM knowledge_bases kb
         WHERE kb.id = ? AND (kb.user_id = ? OR kb.is_public = 1)
         LIMIT 1`
      )
      .bind(kbId, userId)
      .all<any>();

    if (!results || results.length === 0) {
      return ResponseBuilder.notFound("知识库不存在或无权访问", traceId);
    }

    return ResponseBuilder.success(mapKBToDTO(results[0], results[0].doc_count || 0), traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "GET_KB_FAILED", traceId, `获取知识库异常: ${error.message}`, error);
    return ResponseBuilder.internalError("获取知识库失败", traceId);
  }
}

/**
 * 更新知识库 (PUT /api/v1/kb/update)
 */
export async function handleUpdateKB(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const kbId = body.kbId;
    if (!kbId) return ResponseBuilder.badRequest("缺少 kbId 参数", traceId);

    const now = new Date().toISOString();
    const sets: string[] = [];
    const values: any[] = [];

    if (body.name) { sets.push("name = ?"); values.push(body.name.trim()); }
    if (body.description !== undefined) { sets.push("description = ?"); values.push(body.description?.trim() || null); }
    if (body.isPublic !== undefined) { sets.push("is_public = ?"); values.push(body.isPublic ? 1 : 0); }
    if (body.chunkSize) { sets.push("chunk_size = ?"); values.push(body.chunkSize); }
    if (body.chunkOverlap !== undefined) { sets.push("chunk_overlap = ?"); values.push(body.chunkOverlap); }

    if (sets.length === 0) return ResponseBuilder.badRequest("没有可更新的字段", traceId);

    sets.push("updated_at = ?");
    values.push(now);
    values.push(kbId);
    values.push(userId);

    const result = await db
      .prepare(`UPDATE knowledge_bases SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
      .bind(...values)
      .run();

    if (!result.meta.changes) {
      return ResponseBuilder.forbidden("知识库不存在或您无权修改", traceId);
    }

    await CacheService.delete(kv, `rag:kbs:list:${userId}`);
    TraceLogger.info("RAG", "UPDATE_KB_SUCCESS", traceId, `更新知识库成功: kbId=${kbId}`, userId);
    return ResponseBuilder.success({ kbId }, traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "UPDATE_KB_FAILED", traceId, `更新知识库异常: ${error.message}`, error);
    return ResponseBuilder.internalError("更新知识库失败", traceId);
  }
}

/**
 * 删除知识库 (DELETE /api/v1/kb/delete?kbId=xxx)
 */
export async function handleDeleteKB(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const kbId = url.searchParams.get("kbId");
    if (!kbId) return ResponseBuilder.badRequest("缺少 kbId 参数", traceId);

    // 只有知识库所有者可以删除
    const result = await db
      .prepare("DELETE FROM knowledge_bases WHERE id = ? AND user_id = ?")
      .bind(kbId, userId)
      .run();

    if (!result.meta.changes) {
      return ResponseBuilder.forbidden("知识库不存在或您无权删除", traceId);
    }

    // Vectorize 中的向量会依赖 kbId:{chunkId} 格式，需要另外清理
    // 此处先清理 KV 缓存，向量清理在后续异步处理
    await CacheService.delete(kv, `rag:kbs:list:${userId}`);
    TraceLogger.info("RAG", "DELETE_KB_SUCCESS", traceId, `删除知识库成功: kbId=${kbId}`, userId);
    return ResponseBuilder.success({ success: true }, traceId);
  } catch (error: any) {
    TraceLogger.error("RAG", "DELETE_KB_FAILED", traceId, `删除知识库异常: ${error.message}`, error);
    return ResponseBuilder.internalError("删除知识库失败", traceId);
  }
}
