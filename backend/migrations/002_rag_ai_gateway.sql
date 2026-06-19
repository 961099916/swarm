-- Migration 002: RAG 知识库 + AI Gateway 表结构
-- 执行: wrangler d1 execute swarm-db --file=backend/migrations/002_rag_ai_gateway.sql

-- ══════════════════════════════════════════════════
-- 1. agents 表新增 model_config_id
-- ══════════════════════════════════════════════════
ALTER TABLE agents ADD COLUMN model_config_id TEXT;

-- ══════════════════════════════════════════════════
-- 2. knowledge_bases（知识库集合）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  user_id         TEXT REFERENCES users(id),
  is_public       INTEGER NOT NULL DEFAULT 0,
  embedding_model TEXT NOT NULL DEFAULT '@cf/intfloat/multilingual-e5-base',
  chunk_size      INTEGER NOT NULL DEFAULT 500,
  chunk_overlap   INTEGER NOT NULL DEFAULT 100,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ══════════════════════════════════════════════════
-- 3. documents（文档主表）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,
  kb_id           TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK(source_type IN ('UPLOAD','WEB_SCRAPE','MANUAL')),
  source_url      TEXT,
  raw_content     TEXT NOT NULL,
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK(status IN ('PENDING','PROCESSING','READY','FAILED')),
  error_message   TEXT,
  file_name       TEXT,
  file_size       INTEGER,
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_kb_id ON documents(kb_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- ══════════════════════════════════════════════════
-- 4. document_chunks（文档分块元数据）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_chunks (
  id              TEXT PRIMARY KEY,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kb_id           TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL,
  chunk_text      TEXT NOT NULL,
  vector_index_id TEXT,
  token_count     INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_kb_id ON document_chunks(kb_id);

-- ══════════════════════════════════════════════════
-- 5. model_configs（模型路由配置）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS model_configs (
  id                TEXT PRIMARY KEY,
  purpose           TEXT NOT NULL CHECK(purpose IN ('CHAT','EMBEDDING')),
  provider          TEXT NOT NULL DEFAULT 'workers-ai'
                    CHECK(provider IN ('workers-ai','openai','anthropic','azure-openai')),
  model_name        TEXT NOT NULL,
  display_name      TEXT,
  is_default        INTEGER NOT NULL DEFAULT 0,
  is_active         INTEGER NOT NULL DEFAULT 1,
  rate_limit_rpm    INTEGER NOT NULL DEFAULT 30,
  rate_limit_tpm    INTEGER NOT NULL DEFAULT 100000,
  cost_per_1k_input REAL NOT NULL DEFAULT 0,
  cost_per_1k_output REAL NOT NULL DEFAULT 0,
  config_json       TEXT NOT NULL DEFAULT '{}',
  priority          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ══════════════════════════════════════════════════
-- 6. ai_call_logs（AI 调用日志）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id      TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  provider      TEXT NOT NULL,
  model_name    TEXT NOT NULL,
  user_id       TEXT,
  agent_id      TEXT,
  task_id       TEXT,
  kb_id         TEXT,
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  latency_ms    INTEGER DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'SUCCESS'
                CHECK(status IN ('SUCCESS','FAILED','RATE_LIMITED')),
  error_message TEXT,
  cost_usd      REAL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_model ON ai_call_logs(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_logs_purpose ON ai_call_logs(purpose);

-- ══════════════════════════════════════════════════
-- 7. user_rate_limits（用户级速率限制计数器）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_rate_limits (
  user_id       TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  minute_bucket TEXT NOT NULL,
  call_count    INTEGER DEFAULT 0,
  token_count   INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, purpose, minute_bucket)
);

-- ══════════════════════════════════════════════════
-- 种子数据: AI Gateway 默认模型配置
-- ══════════════════════════════════════════════════
INSERT OR IGNORE INTO model_configs (id, purpose, provider, model_name, display_name, is_default, is_active, rate_limit_rpm, rate_limit_tpm) VALUES
('mc-chat-llama',   'CHAT',     'workers-ai', '@cf/meta/llama-3.1-8b-instruct-fp8',  'Llama 3.1 8B',  1, 1, 60, 200000),
('mc-chat-llama32', 'CHAT',     'workers-ai', '@cf/meta/llama-3.2-3b-instruct',       'Llama 3.2 3B',  0, 1, 120, 500000),
('mc-embed-e5',     'EMBEDDING','workers-ai', '@cf/intfloat/multilingual-e5-base',   'E5 Multilingual', 1, 1, 120, 500000);
