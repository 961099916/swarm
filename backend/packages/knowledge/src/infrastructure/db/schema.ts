// File: packages/knowledge/src/infrastructure/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * knowledge_bases — 知识库集合
 */
export const knowledgeBases = sqliteTable("knowledge_bases", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id"),
  isPublic: integer("is_public").default(0).notNull(),
  embeddingModel: text("embedding_model").default("@cf/intfloat/multilingual-e5-base").notNull(),
  chunkSize: integer("chunk_size").default(500).notNull(),
  chunkOverlap: integer("chunk_overlap").default(100).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * documents — 文档主表
 */
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  kbId: text("kb_id").notNull(),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  rawContent: text("raw_content").notNull(),
  chunkCount: integer("chunk_count").default(0).notNull(),
  status: text("status").default("PENDING").notNull(),
  errorMessage: text("error_message"),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * document_chunks — 文档分块元数据
 */
export const documentChunks = sqliteTable("document_chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  kbId: text("kb_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  chunkText: text("chunk_text").notNull(),
  vectorIndexId: text("vector_index_id"),
  tokenCount: integer("token_count").default(0).notNull(),
  createdAt: text("created_at").notNull(),
});
