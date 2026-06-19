/**
 * swarm-doc-consumer — 文档处理异步队列消费者
 *
 * 从 Queue 接收文档处理消息，异步执行：
 *   获取内容 → 分块 → 嵌入 → 存储 → 标记就绪
 *
 * 与 RAG Worker 解耦，RAG 只负责写 D1 + 发 Queue，
 * Consumer 负责耗时的文档处理管道。
 */

import { TraceLogger, RAG_EMBED_PASSAGE_PREFIX } from "@swarm/shared";

// ══════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════

export interface Env {
  DB: D1Database;
  AI: any;
}

export interface DocQueueMessage {
  docId: string;
  kbId: string;
  sourceType: 'WEB_SCRAPE' | 'MANUAL';
  sourceUrl?: string;
  rawContent?: string;
}

interface ChunkResult {
  index: number;
  text: string;
  tokenCount: number;
}

// ══════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════

async function updateDocStatus(
  db: D1Database,
  docId: string,
  status: string,
  extra: Record<string, any> = {}
): Promise<void> {
  const sets = ["status = ?", "updated_at = ?"];
  const values: any[] = [status, new Date().toISOString()];

  if (extra.chunkCount !== undefined) { sets.push("chunk_count = ?"); values.push(extra.chunkCount); }
  if (extra.title !== undefined) { sets.push("title = ?"); values.push(extra.title); }
  if (extra.errorMessage !== undefined) { sets.push("error_message = ?"); values.push(extra.errorMessage); }

  values.push(docId);
  await db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}

function estimateTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    if (ch >= '\u4e00' && ch <= '\u9fff') tokens += 1.5;
    else tokens += 0.25;
  }
  return Math.ceil(tokens);
}

// ══════════════════════════════════════════════════
// 分块器（递归分割）
// ══════════════════════════════════════════════════

function splitText(text: string, chunkSize = 500, chunkOverlap = 100): ChunkResult[] {
  if (!text || text.trim().length === 0) return [];
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length === 0) return [];

  const chunks: ChunkResult[] = [];
  const paragraphs = cleaned.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  let currentChunk = "";

  function flush(): void {
    if (currentChunk.trim().length === 0) return;
    chunks.push({ index: chunks.length, text: currentChunk.trim(), tokenCount: estimateTokens(currentChunk.trim()) });
  }

  for (const para of paragraphs) {
    if (estimateTokens(para) > chunkSize) {
      if (currentChunk) { flush(); currentChunk = ""; }
      // 按句分割
      const sentences = para.split(/(?<=[。！？.!?\n])/g).map(s => s.trim()).filter(s => s.length > 0);
      let buf = "";
      for (const s of sentences) {
        if (estimateTokens(buf + s) > chunkSize) {
          if (buf) { chunks.push({ index: chunks.length, text: buf.trim(), tokenCount: estimateTokens(buf.trim()) }); }
          buf = s;
        } else { buf += s; }
      }
      if (buf) chunks.push({ index: chunks.length, text: buf.trim(), tokenCount: estimateTokens(buf.trim()) });
      continue;
    }

    if (estimateTokens(currentChunk + para) > chunkSize) {
      flush();
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n" : "") + para;
    }
  }
  if (currentChunk.trim()) flush();
  return chunks;
}

// ══════════════════════════════════════════════════
// 嵌入生成
// ══════════════════════════════════════════════════

async function generateEmbeddings(
  ai: any,
  texts: string[],
  model = "@cf/baai/bge-small-en-v1.5"
): Promise<number[][]> {
  const batchSize = 10;
  const allVectors: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await ai.run(model, { text: batch.map(t => `${t}`) });
    const data: number[][] = res?.data || [];
    allVectors.push(...data);
  }
  return allVectors;
}

// ══════════════════════════════════════════════════
// 核心文档处理
// ══════════════════════════════════════════════════

async function processDocument(
  db: D1Database,
  ai: any,
  msg: DocQueueMessage,
  traceId: string
): Promise<void> {
  const { docId, kbId, sourceType, sourceUrl, rawContent } = msg;

  // 1. 标记处理中
  await updateDocStatus(db, docId, "PROCESSING");
  TraceLogger.info("DOC_CONSUMER", "PROCESSING", traceId, `开始处理文档: docId=${docId}`);

  // 2. 获取/提取内容
  let title: string;
  let content: string;

  if (sourceType === 'WEB_SCRAPE' && sourceUrl) {
    TraceLogger.info("DOC_CONSUMER", "FETCHING", traceId, `抓取网页: ${sourceUrl}`);
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SwarmDocBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    title = titleMatch ? titleMatch[1].trim() : sourceUrl;

    content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } else if (sourceType === 'MANUAL' && rawContent) {
    const doc = await db.prepare("SELECT title FROM documents WHERE id = ?").bind(docId).first<any>();
    title = doc?.title || "手动录入文档";
    content = rawContent;
  } else {
    throw new Error(`不支持的文档类型: ${sourceType}`);
  }

  if (!content || content.length < 20) throw new Error("文档内容为空或过短");

  // 3. 读取知识库分块配置
  const kb = await db.prepare("SELECT chunk_size, chunk_overlap FROM knowledge_bases WHERE id = ?").bind(kbId).first<any>();
  const chunkSize = kb?.chunk_size || 500;
  const chunkOverlap = kb?.chunk_overlap || 100;

  // 4. 分块
  const chunks = splitText(content, chunkSize, chunkOverlap);
  TraceLogger.info("DOC_CONSUMER", "CHUNKED", traceId, `分块完成: ${chunks.length} 个块`);

  if (chunks.length === 0) throw new Error("分块后内容为空");

  // 5. 生成嵌入
  const texts = chunks.map(c => c.text);
  const vectors = await generateEmbeddings(ai, texts);
  TraceLogger.info("DOC_CONSUMER", "EMBEDDED", traceId, `嵌入生成完成: ${vectors.length} 个向量`);

  // 6. 写入 D1
  const now = new Date().toISOString();
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkId = `${kbId}:${docId}:${chunk.index}`;
    await db
      .prepare(
        `INSERT OR REPLACE INTO document_chunks (id, document_id, kb_id, chunk_index, chunk_text, vector_index_id, token_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(chunkId, docId, kbId, chunk.index, chunk.text, chunkId, chunk.tokenCount, now)
      .run();
  }

  // 7. 更新内容 + 标记就绪
  if (sourceType === 'WEB_SCRAPE') {
    await db.prepare("UPDATE documents SET raw_content = ?, title = ? WHERE id = ?").bind(content, title, docId).run();
  }
  await updateDocStatus(db, docId, "READY", { chunkCount: chunks.length, title });
  TraceLogger.info("DOC_CONSUMER", "COMPLETED", traceId, `文档处理完成: ${chunks.length} 个块`);
}

// ══════════════════════════════════════════════════
// Queue 消息处理器
// ══════════════════════════════════════════════════

async function queue(
  batch: MessageBatch<DocQueueMessage>,
  env: Env
): Promise<void> {
  for (const msg of batch.messages) {
    const { docId, kbId } = msg.body;
    const traceId = `doc-consumer-${docId}`;

    TraceLogger.info("DOC_CONSUMER", "QUEUE_RECEIVED", traceId, `消费文档处理消息: docId=${docId}`);

    try {
      await processDocument(env.DB, env.AI, msg.body, traceId);
      msg.ack();
    } catch (err: any) {
      TraceLogger.error("DOC_CONSUMER", "PROCESS_FAILED", traceId, `文档处理失败: ${err.message}`, err);

      // 更新数据库状态为失败
      try {
        await updateDocStatus(env.DB, docId, "FAILED", { errorMessage: err.message || "未知错误" });
      } catch (dbErr: any) {
        TraceLogger.error("DOC_CONSUMER", "STATUS_UPDATE_FAILED", traceId, `更新失败状态异常: ${dbErr.message}`, dbErr);
      }

      if (msg.attempts >= 3) {
        TraceLogger.warn("DOC_CONSUMER", "MAX_RETRIES", traceId, `消息已达最大重试次数: docId=${docId}`);
        msg.ack();
      } else {
        msg.retry({ delaySeconds: 10 });
      }
    }
  }
}

// ══════════════════════════════════════════════════
// Health check 与导出
// ══════════════════════════════════════════════════

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ status: "ok" });
    return new Response("Not Found", { status: 404 });
  },
  queue,
};
