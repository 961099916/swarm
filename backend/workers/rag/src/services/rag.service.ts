// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/services/rag.service.ts

import { RagRepository } from "../repositories/rag.repository";
import { RagConstants } from "../constants/rag.constant";
import { eq, or, like } from "drizzle-orm";
import { knowledgeBases, documents } from "@swarm/knowledge";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";
import { RAG_MAX_CONTEXT_LENGTH } from "@swarm/knowledge";

export class RagService {
  constructor(private ragRepo: RagRepository) {}

  // ══════════════════════════════════════════════════
  // 知识库管理
  // ══════════════════════════════════════════════════

  public async getKBs(url: URL, userId: string, userRole: string) {
    const limit = Math.min(RagConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));

    const conditions: any[] = [];
    if (userRole !== "ADMIN") {
      conditions.push(or(eq(knowledgeBases.userId, userId), eq(knowledgeBases.isPublic, 1)));
    }

    return await this.ragRepo.findKnowledgeBases({ conditions, limit, offset });
  }

  public async createKB(userId: string, body: any) {
    const { name, description, isPublic, chunkSize, chunkOverlap } = body;
    if (!name?.trim()) throw new Error("MISSING_KB_NAME");

    const kbId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.ragRepo.createKB({
      id: kbId,
      name: name.trim(),
      description: description || "",
      userId,
      isPublic: isPublic ? 1 : 0,
      embeddingModel: RagConstants.DEFAULT_EMBEDDING_MODEL,
      chunkSize: chunkSize || RagConstants.DEFAULT_CHUNK_SIZE,
      chunkOverlap: chunkOverlap || RagConstants.DEFAULT_CHUNK_OVERLAP,
      createdAt: now,
      updatedAt: now,
    });

    return kbId;
  }

  public async verifyKBAccess(kbId: string, userId: string): Promise<boolean> {
    const kb = await this.ragRepo.findKBById(kbId);
    if (!kb) return false;
    return kb.isPublic === 1 || kb.userId === userId;
  }

  public async updateKB(kbId: string, userId: string, userRole: string, body: any) {
    const kb = await this.ragRepo.findKBById(kbId);
    if (!kb) throw new Error("KB_NOT_FOUND");
    if (userRole !== "ADMIN" && kb.userId !== userId) throw new Error("PERMISSION_DENIED");

    const updates: any = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.isPublic !== undefined) updates.isPublic = body.isPublic ? 1 : 0;

    await this.ragRepo.updateKB(kbId, updates);
  }

  public async deleteKB(kbId: string, userId: string, userRole: string) {
    const kb = await this.ragRepo.findKBById(kbId);
    if (!kb) throw new Error("KB_NOT_FOUND");
    if (userRole !== "ADMIN" && kb.userId !== userId) throw new Error("PERMISSION_DENIED");

    await this.ragRepo.deleteKB(kbId);
  }

  // ══════════════════════════════════════════════════
  // 文档管理
  // ══════════════════════════════════════════════════

  public async getDocuments(kbId: string, url: URL, userId: string) {
    const limit = Math.min(RagConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));

    const hasAccess = await this.verifyKBAccess(kbId, userId);
    if (!hasAccess) throw new Error("PERMISSION_DENIED");

    const conditions = [eq(documents.kbId, kbId)];
    return await this.ragRepo.findDocuments({ conditions, limit, offset });
  }

  public async deleteDocument(docId: string, userId: string, userRole: string) {
    const doc = await this.ragRepo.findDocumentById(docId);
    if (!doc) throw new Error("DOC_NOT_FOUND");

    const kb = await this.ragRepo.findKBById(doc.kbId);
    if (userRole !== "ADMIN" && kb?.userId !== userId) throw new Error("PERMISSION_DENIED");

    await this.ragRepo.deleteDocument(docId);
    await this.ragRepo.deleteChunksByDocId(docId);
  }

  public async addDocumentByUrl(params: {
    userId: string;
    body: any;
    docQueue: any;
    traceId: string;
  }): Promise<string> {
    const { userId, body, docQueue, traceId } = params;
    if (!body.kbId || !body.url) throw new Error("MISSING_PARAMS");

    let finalUrl = body.url.trim();
    if (!finalUrl) throw new Error("EMPTY_URL");
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;

    const hasAccess = await this.verifyKBAccess(body.kbId, userId);
    if (!hasAccess) throw new Error("PERMISSION_DENIED");

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.ragRepo.createDocument({
      id: docId,
      kbId: body.kbId,
      title: body.title || finalUrl,
      sourceType: RagConstants.SOURCE_WEB_SCRAPE,
      sourceUrl: finalUrl,
      rawContent: "",
      status: RagConstants.DOC_STATUS_PENDING,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await this.sendToQueue(docQueue, { docId, kbId: body.kbId, sourceType: "WEB_SCRAPE", sourceUrl: finalUrl }, docId, traceId, userId);
    return docId;
  }

  public async addDocumentManual(params: {
    userId: string;
    body: any;
    docQueue: any;
    traceId: string;
  }): Promise<string> {
    const { userId, body, docQueue, traceId } = params;
    if (!body.kbId || !body.title || !body.content) throw new Error("MISSING_PARAMS");

    const hasAccess = await this.verifyKBAccess(body.kbId, userId);
    if (!hasAccess) throw new Error("PERMISSION_DENIED");

    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.ragRepo.createDocument({
      id: docId,
      kbId: body.kbId,
      title: body.title.trim(),
      sourceType: RagConstants.SOURCE_MANUAL,
      rawContent: body.content,
      status: RagConstants.DOC_STATUS_PENDING,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await this.sendToQueue(docQueue, { docId, kbId: body.kbId, sourceType: "MANUAL", rawContent: body.content }, docId, traceId, userId);
    return docId;
  }

  private async sendToQueue(queue: any, payload: any, docId: string, traceId: string, userId: string) {
    try {
      if (queue && typeof queue.send === "function") {
        await queue.send(payload);
        TraceLogger.info("RAG", "DOC_ENQUEUED", traceId, `文档消息已入队: docId=${docId}`, userId);
      } else {
        TraceLogger.warn("RAG", "DOC_QUEUE_NOT_BOUND", traceId, `DOC_QUEUE 未绑定，文档 ${docId} 停留在 PENDING`);
      }
    } catch (qErr: unknown) {
      TraceLogger.error("RAG", "DOC_ENQUEUE_FAILED", traceId, `文档入队失败: ${getErrorMessage(qErr)}`, qErr);
    }
  }

  // ══════════════════════════════════════════════════
  // 核心检索与 RAG 注入
  // ══════════════════════════════════════════════════

  public extractKeywords(query: string): string[] {
    return query
      .replace(/[，。！？、；：""''（）【】\s,.!?;:()\[\]{}]+/g, " ")
      .split(" ")
      .map(w => w.trim())
      .filter(w => w.length > 1);
  }

  public async keywordSearch(kbId: string, query: string, topK: number, traceId: string) {
    const words = this.extractKeywords(query);
    if (words.length === 0) return [];

    const conditions = words.map(() => `dc.chunk_text LIKE ?`);
    const likeParams = words.map(w => `%${w}%`);

    const dbResults = await this.ragRepo.keywordSearchDirect(kbId, conditions, likeParams, topK * 3);
    return this.scoreChunks(dbResults, words, query, kbId);
  }

  private scoreChunks(results: any[], words: string[], query: string, kbId: string) {
    const scored = results.map((r: any) => {
      const text = (r.chunk_text || "").toLowerCase();
      let score = 0;
      for (const word of words) {
        if (text.includes(word.toLowerCase())) {
          score += 1;
          if ((r.title || "").toLowerCase().includes(word.toLowerCase())) score += 1;
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

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5).filter(r => r.score > 0);
  }

  public async injectRAGContext(kbIds: string[], query: string, maxChunks: number, traceId: string) {
    const allChunks: any[] = [];
    for (const kbId of kbIds) {
      const chunks = await this.keywordSearch(kbId, query, maxChunks, traceId);
      allChunks.push(...chunks);
    }

    allChunks.sort((a, b) => b.score - a.score);
    const topChunks = allChunks.slice(0, maxChunks);

    let context = "";
    if (topChunks.length > 0) {
      context = "以下是从知识库中检索到的参考信息：\n\n";
      for (const chunk of topChunks) {
        const header = `【${chunk.documentTitle} - 片段 ${chunk.chunkIndex + 1}】`;
        const content = chunk.content.length > 500 ? chunk.content.slice(0, 500) + "..." : chunk.content;
        context += `${header}\n${content}\n\n`;
      }
      if (context.length > RAG_MAX_CONTEXT_LENGTH) {
        context = context.slice(0, RAG_MAX_CONTEXT_LENGTH) + "\n...(上下文已截断)";
      }
    }

    return { context, chunks: topChunks };
  }

  public async getGlobalDocuments(url: URL) {
    const limit = Math.min(RagConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
    
    // 传 conditions = [] 以便获取全系统文档
    return await this.ragRepo.findDocuments({ conditions: [], limit, offset });
  }
}
