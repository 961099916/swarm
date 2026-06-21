// File: packages/knowledge/src/constants.ts
/// <reference types="@cloudflare/workers-types" />
import { ConfigService } from "@swarm/kernel";

/** 嵌入生成前缀（e5 模型物理接口要求）*/
export const RAG_EMBED_PASSAGE_PREFIX = "passage: ";
export const RAG_EMBED_QUERY_PREFIX = "query: ";

/**
 * KnowledgeConfig — 知识库与 RAG 动态配置读取门面
 */
export const KnowledgeConfig = {
  /** 默认分块字符数 */
  async getDefaultChunkSize(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "knowledge.default_chunk_size");
  },

  /** 默认分块重叠字符数 */
  async getDefaultChunkOverlap(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "knowledge.default_chunk_overlap");
  },

  /** 默认检索 Top-K */
  async getDefaultTopK(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "knowledge.default_top_k");
  },

  /** 最低相似度阈值 */
  async getDefaultMinScore(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "knowledge.default_min_score");
  },

  /** RAG 上下文注入最大字符数 */
  async getMaxContextLength(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "knowledge.max_context_length");
  },

  /** 文档最大文件大小（字节） */
  async getMaxFileSize(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "knowledge.max_file_size");
  },

  /** 嵌入并发上限 */
  async getMaxConcurrentEmbeddings(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "knowledge.max_concurrent_embeddings");
  },

  /** 默认嵌入模型 */
  async getDefaultEmbedModel(db: D1Database): Promise<string> {
    return ConfigService.get(db, "knowledge.default_embed_model");
  }
};
