// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/repositories/rag.repository.ts

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import { knowledgeBases, documents, documentChunks } from "@swarm/knowledge";

export class RagRepository {
  constructor(public readonly db: D1Database) {}

  private getDrizzle() {
    return drizzle(this.db);
  }

  // ══════════════════════════════════════════════════
  // 知识库 (Knowledge Base)
  // ══════════════════════════════════════════════════

  public async findKnowledgeBases(params: {
    conditions: any[];
    limit: number;
    offset: number;
  }) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select()
      .from(knowledgeBases)
      .where(params.conditions.length > 0 ? and(...params.conditions) : undefined)
      .orderBy(desc(knowledgeBases.createdAt))
      .limit(params.limit)
      .offset(params.offset);
  }

  public async findKBById(kbId: string) {
    const drizzleDb = this.getDrizzle();
    const res = await drizzleDb.select().from(knowledgeBases).where(eq(knowledgeBases.id, kbId));
    return res[0] || null;
  }

  public async createKB(values: any) {
    const drizzleDb = this.getDrizzle();
    await drizzleDb.insert(knowledgeBases).values(values);
  }

  public async updateKB(kbId: string, values: any) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb.update(knowledgeBases).set(values).where(eq(knowledgeBases.id, kbId));
    return result.meta.changes > 0;
  }

  public async deleteKB(kbId: string) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb.delete(knowledgeBases).where(eq(knowledgeBases.id, kbId));
    return result.meta.changes > 0;
  }

  // ══════════════════════════════════════════════════
  // 文档 (Documents)
  // ══════════════════════════════════════════════════

  public async findDocuments(params: {
    conditions: any[];
    limit: number;
    offset: number;
  }) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select()
      .from(documents)
      .where(params.conditions.length > 0 ? and(...params.conditions) : undefined)
      .orderBy(desc(documents.createdAt))
      .limit(params.limit)
      .offset(params.offset);
  }

  public async findDocumentById(docId: string) {
    const drizzleDb = this.getDrizzle();
    const res = await drizzleDb.select().from(documents).where(eq(documents.id, docId));
    return res[0] || null;
  }

  public async createDocument(values: any) {
    const drizzleDb = this.getDrizzle();
    await drizzleDb.insert(documents).values(values);
  }

  public async updateDocument(docId: string, values: any) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb.update(documents).set(values).where(eq(documents.id, docId));
    return result.meta.changes > 0;
  }

  public async deleteDocument(docId: string) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb.delete(documents).where(eq(documents.id, docId));
    return result.meta.changes > 0;
  }

  // ══════════════════════════════════════════════════
  // 文档分块 (Document Chunks)
  // ══════════════════════════════════════════════════

  public async createChunksBatch(chunks: any[]) {
    if (chunks.length === 0) return;
    const drizzleDb = this.getDrizzle();
    await drizzleDb.insert(documentChunks).values(chunks);
  }

  public async deleteChunksByDocId(docId: string) {
    const drizzleDb = this.getDrizzle();
    await drizzleDb.delete(documentChunks).where(eq(documentChunks.documentId, docId));
  }

  public async findChunksByKBId(kbId: string) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.kbId, kbId));
  }

  public async keywordSearchDirect(kbId: string, conditions: string[], likeParams: string[], limit: number) {
    const sqlQuery = `
      SELECT dc.id, dc.document_id, dc.chunk_index, dc.chunk_text, d.title
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.kb_id = ? AND (${conditions.join(' OR ')})
      ORDER BY dc.created_at DESC
      LIMIT ?
    `;
    const { results } = await this.db
      .prepare(sqlQuery)
      .bind(kbId, ...likeParams, limit)
      .all<any>();
    return results || [];
  }
}
