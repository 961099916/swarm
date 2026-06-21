// File: packages/knowledge/src/index.ts
/**
 * @swarm/knowledge — 知识库与 RAG 限界上下文
 *
 * Bounded Context (DDD): 知识库集合、文档分块、向量检索
 * Aggregate Roots: Document (文档聚合根)
 */

export { knowledgeBases, documents, documentChunks } from './infrastructure/db/schema';
export type {
  KnowledgeBaseRow, DocumentRow, DocumentChunkRow,
  KnowledgeBaseDTO, DocumentDTO, CreateKnowledgeBaseReq,
  AddDocumentByUrlReq, AddDocumentManualReq,
  RAGChunk, RAGInjectResult,
} from './types';
export {
  RAG_EMBED_PASSAGE_PREFIX, RAG_EMBED_QUERY_PREFIX,
  KnowledgeConfig,
} from './constants';
