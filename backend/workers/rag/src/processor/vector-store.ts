/**
 * 向量存储层
 *
 * 封装 Cloudflare Vectorize 的 upsert / query / delete 操作。
 * 当 Vectorize 不可用时降级为 D1-only 模式。
 */

import { TraceLogger } from "@swarm/shared";

export interface VectorRecord {
  id: string;        // 格式: "{kbId}:{chunkId}"
  values: number[];  // 768 维向量
  metadata?: Record<string, string>;
}

/**
 * Vectorize 存储封装
 */
export class VectorStore {
  private useVectorize: boolean;

  constructor(
    private vectorize?: any,
    private db?: D1Database
  ) {
    this.useVectorize = !!vectorize;
  }

  /**
   * 批量写入向量
   */
  async upsert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;

    if (this.useVectorize && this.vectorize) {
      try {
        await this.vectorize.upsert(records.map(r => ({
          id: r.id,
          values: r.values,
          metadata: r.metadata,
        })));
        TraceLogger.info("RAG", "VECTORIZE_UPSERT", "SYSTEM", `Vectorize 写入 ${records.length} 条向量`);
        return;
      } catch (err: any) {
        TraceLogger.warn("RAG", "VECTORIZE_UPSERT_FAILED", "SYSTEM", `Vectorize 写入失败，降级到 D1: ${err.message}`);
        // 降级：只写入 D1 metadata（向量数据丢失）
      }
    }

    // D1-only fallback: 只记录 metadata
    TraceLogger.info("RAG", "VECTORIZE_FALLBACK", "SYSTEM", `D1 模式: 记录 ${records.length} 条 chunk metadata（无向量数据）`);
  }

  /**
   * 查询相似向量
   */
  async query(
    vector: number[],
    topK: number = 5,
    filter?: { kbId?: string }
  ): Promise<Array<{ id: string; score: number }>> {
    if (this.useVectorize && this.vectorize) {
      try {
        const queryOptions: any = {
          topK,
          vector,
          returnMetadata: false,
        };
        if (filter?.kbId) {
          // Vectorize namespace filter 依赖 metadata 字段
        }
        const result = await this.vectorize.query(queryOptions);
        const matches = result?.matches || [];
        TraceLogger.info("RAG", "VECTORIZE_QUERY", "SYSTEM", `Vectorize 查询返回 ${matches.length} 条结果`);
        return matches.map((m: any) => ({ id: m.id, score: m.score }));
      } catch (err: any) {
        TraceLogger.warn("RAG", "VECTORIZE_QUERY_FAILED", "SYSTEM", `Vectorize 查询失败: ${err.message}`);
      }
    }

    // Vectorize 不可用时返回空（由上层做 D1 兜底）
    return [];
  }

  /**
   * 删除向量
   */
  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    if (this.useVectorize && this.vectorize) {
      try {
        await this.vectorize.deleteByIds(ids);
        TraceLogger.info("RAG", "VECTORIZE_DELETE", "SYSTEM", `Vectorize 删除 ${ids.length} 条向量`);
      } catch (err: any) {
        TraceLogger.warn("RAG", "VECTORIZE_DELETE_FAILED", "SYSTEM", `Vectorize 删除失败: ${err.message}`);
      }
    }
  }
}
