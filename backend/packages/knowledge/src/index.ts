/**
 * @swarm/knowledge — 知识库与 RAG 限界上下文
 *
 * Bounded Context (DDD): 知识库管理、文档处理、向量检索、RAG 上下文注入
 * Aggregate Roots: KnowledgeBase (知识库聚合), Document (文档聚合)
 */

export { knowledgeBases, documents, documentChunks } from './schema';
export type {
  KnowledgeBaseDTO, KnowledgeBaseRow,
  DocumentDTO, DocumentRow, DocumentChunkRow,
  CreateKnowledgeBaseReq, AddDocumentByUrlReq, AddDocumentManualReq,
  RAGChunk, RAGInjectResult,
} from './types';
export {
  RAG_DEFAULT_CHUNK_SIZE, RAG_DEFAULT_CHUNK_OVERLAP,
  RAG_DEFAULT_TOP_K, RAG_DEFAULT_MIN_SCORE,
  RAG_EMBED_PASSAGE_PREFIX, RAG_EMBED_QUERY_PREFIX,
  RAG_MAX_CONTEXT_LENGTH, RAG_MAX_FILE_SIZE,
  RAG_MAX_CONCURRENT_EMBEDDINGS, DEFAULT_EMBED_MODEL,
} from './constants';
