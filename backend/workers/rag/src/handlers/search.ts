import { TraceLogger } from "@swarm/kernel";
import { RAG_DEFAULT_MIN_SCORE, RAG_DEFAULT_TOP_K, RAG_MAX_CONTEXT_LENGTH } from "@swarm/knowledge";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/handlers/search.ts

import { ResponseBuilder } from "../utils/response";

/**
 * 知识库搜索 (POST /api/v1/kb/search)
 */
export async function handleSearchKnowledge(
  request: Request,
  env: { DB: D1Database; CACHE_KV: KVNamespace; AI: any },
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      kbId: string;
      query: string;
      topK?: number;
      minScore?: number;
    };

    if (!body.kbId || !body.query) {
      return ResponseBuilder.badRequest("缺少必填参数 kbId 或 query", traceId);
    }

    const topK = body.topK || RAG_DEFAULT_TOP_K;
    const minScore = body.minScore || RAG_DEFAULT_MIN_SCORE;

    // 1. 使用关键词搜索（Vectorize 接入前过渡方案）
    const results = await keywordSearchFallback(env.DB, body.kbId, body.query, topK, traceId);

    TraceLogger.info("RAG", "SEARCH_RESULTS", traceId, `知识库搜索完成: kbId=${body.kbId}, query="${body.query.slice(0, 50)}", 结果数=${results.length}`, userId);

    return ResponseBuilder.success({
      results,
      totalChunks: results.length,
    }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("RAG", "SEARCH_FAILED", traceId, `知识库搜索异常: getErrorMessage(error)`, error);
    return ResponseBuilder.internalError("知识检索失败", traceId);
  }
}

/**
 * RAG 上下文注入（内部 API，供 Workflow 调用）
 * POST /api/v1/rag/inject
 */
export async function handleRAGContextInject(
  request: Request,
  env: { DB: D1Database; CACHE_KV: KVNamespace; AI: any },
  traceId: string
): Promise<Response> {
  try {
    const body = await request.json() as {
      kbIds: string[];
      query: string;
      maxChunks?: number;
      minScore?: number;
    };

    if (!body.kbIds || body.kbIds.length === 0 || !body.query) {
      return ResponseBuilder.badRequest("缺少必填参数 kbIds 或 query", traceId);
    }

    const maxChunks = body.maxChunks || 5;
    const minScore = body.minScore || 0.4;

    // 从多个知识库检索
    const allChunks: Array<{
      chunkId: string;
      documentId: string;
      documentTitle: string;
      kbId: string;
      chunkIndex: number;
      content: string;
      score: number;
    }> = [];

    for (const kbId of body.kbIds) {
      const chunks = await keywordSearchFallback(env.DB, kbId, body.query, maxChunks, traceId);
      allChunks.push(...chunks);
    }

    // 按 score 排序，取 top maxChunks
    allChunks.sort((a, b) => b.score - a.score);
    const topChunks = allChunks.slice(0, maxChunks);

    // 组装 context 文本
    let context = "";
    if (topChunks.length > 0) {
      context = "以下是从知识库中检索到的参考信息：\n\n";
      for (const chunk of topChunks) {
        const header = `【${chunk.documentTitle} - 片段 ${chunk.chunkIndex + 1}】`;
        const content = chunk.content.length > 500
          ? chunk.content.slice(0, 500) + "..."
          : chunk.content;
        context += `${header}\n${content}\n\n`;
      }

      // 限制上下文长度
      if (context.length > RAG_MAX_CONTEXT_LENGTH) {
        context = context.slice(0, RAG_MAX_CONTEXT_LENGTH) + "\n...(上下文已截断)";
      }
    }

    return ResponseBuilder.success({
      context,
      chunks: topChunks,
    }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("RAG", "CONTEXT_INJECT_FAILED", traceId, `RAG 上下文注入异常: getErrorMessage(error)`, error);
    // 注入失败时返回空 context，不影响 Agent 主流程
    return ResponseBuilder.success({ context: "", chunks: [] }, traceId);
  }
}

// ══════════════════════════════════════════════════
// 嵌入生成
// ══════════════════════════════════════════════════

async function generateEmbedding(ai: any, text: string): Promise<number[] | null> {
  try {
    const model = "@cf/baai/bge-small-en-v1.5";
    const res = await ai.run(model, {
      text: [`${text}`]
    });
    return res?.data?.[0] || null;
  } catch (err) {
    TraceLogger.error("RAG", "EMBED_FAILED", "SYSTEM", `嵌入生成失败: ${err}`);
    return null;
  }
}

// ══════════════════════════════════════════════════
// Vectorize 尚未接入时的 D1 全文搜索兜底
// ══════════════════════════════════════════════════

async function vectorSearchFallback(
  db: D1Database,
  kbId: string,
  topK: number,
  minScore: number,
  traceId: string
): Promise<Array<{
  chunkId: string;
  documentId: string;
  documentTitle: string;
  kbId: string;
  chunkIndex: number;
  content: string;
  score: number;
}>> {
  // 已废弃：使用 keywordSearchFallback 替代
  return keywordSearchFallback(db, kbId, '', topK, traceId);
}

/**
 * 关键词搜索版 D1 兜底
 */
async function keywordSearchFallback(
  db: D1Database,
  kbId: string,
  query: string,
  topK: number,
  traceId: string
): Promise<Array<{
  chunkId: string;
  documentId: string;
  documentTitle: string;
  kbId: string;
  chunkIndex: number;
  content: string;
  score: number;
}>> {
  try {
    // 提取关键词（去掉标点和停用词）
    const words = query
      .replace(/[，。！？、；：""''（）【】\s,.!?;:()\[\]{}]+/g, ' ')
      .split(' ')
      .map(w => w.trim())
      .filter(w => w.length > 1);

    if (words.length === 0) return [];

    // 构建 LIKE 条件
    const conditions = words.map(() => `dc.chunk_text LIKE ?`);
    const likeParams = words.map(w => `%${w}%`);

    const { results } = await db
      .prepare(
        `SELECT dc.id, dc.document_id, dc.chunk_index, dc.chunk_text, d.title
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id
         WHERE dc.kb_id = ? AND (${conditions.join(' OR ')})
         ORDER BY dc.created_at DESC
         LIMIT ?`
      )
      .bind(kbId, ...likeParams, topK * 3)
      .all<any>();

    if (!results || results.length === 0) return [];

    // 在 JS 中计算关键词匹配得分
    const scored = results.map((r: any) => {
      const text = (r.chunk_text || '').toLowerCase();
      const q = query.toLowerCase();
      let score = 0;
      for (const word of words) {
        const idx = text.indexOf(word.toLowerCase());
        if (idx !== -1) {
          score += 1;
          // 标题匹配加分
          if ((r.title || '').toLowerCase().includes(word.toLowerCase())) score += 1;
        }
      }
      return {
        chunkId: r.id,
        documentId: r.document_id,
        documentTitle: r.title,
        kbId,
        chunkIndex: r.chunk_index,
        content: r.chunk_text,
        score,
      };
    });

    // 按得分排序，取 topK
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter(r => r.score > 0);
  } catch (err) {
    TraceLogger.error("RAG", "KEYWORD_SEARCH_FAILED", traceId, `关键词搜索失败: ${err}`);
    return [];
  }
}
