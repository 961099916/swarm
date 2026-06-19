// ─── 数据库行类型 ───
export interface KnowledgeBaseRow {
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

export interface DocumentRow {
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

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  kb_id: string;
  chunk_index: number;
  chunk_text: string;
  vector_index_id: string | null;
  token_count: number;
  created_at: string;
}

// ─── API DTO ───
export interface KnowledgeBaseDTO {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  isPublic: boolean;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDTO {
  id: string;
  kbId: string;
  title: string;
  sourceType: 'UPLOAD' | 'WEB_SCRAPE' | 'MANUAL';
  sourceUrl?: string;
  chunkCount: number;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  errorMessage?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseReq {
  name: string;
  description?: string;
  isPublic?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface AddDocumentByUrlReq {
  kbId: string;
  url: string;
  title?: string;
}

export interface AddDocumentManualReq {
  kbId: string;
  title: string;
  content: string;
}

// ─── RAG 内部 DTO ───
export interface RAGChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  kbId: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface RAGInjectResult {
  context: string;
  chunks: RAGChunk[];
}
