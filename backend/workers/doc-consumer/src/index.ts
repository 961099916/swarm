// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/doc-consumer/src/index.ts

/**
 * swarm-doc-consumer — 文档处理异步队列消费者
 *
 * 从 Queue 接收文档处理消息，异步执行：
 *   获取内容 → 分块 → 嵌入 → 存储 → 标记就绪
 */

import { TraceLogger, getErrorMessage, ConfigService } from "@swarm/kernel";
import { DocConsumerConstants } from "./constants/doc-consumer.constant";

export interface Env {
  DB: D1Database;
  AI: any;
}

export interface DocQueueMessage {
  docId: string;
  kbId: string;
  sourceType: "WEB_SCRAPE" | "MANUAL";
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
    if (ch >= "\u4e00" && ch <= "\u9fff") tokens += 1.5;
    else tokens += 0.25;
  }
  return Math.ceil(tokens);
}

// ══════════════════════════════════════════════════
// HTML 与 Markdown 清洗与纯净化工具函数
// ══════════════════════════════════════════════════

function htmlToMarkdown(html: string): string {
  if (!html) return "";

  // 1. 去除无用的 script、style、iframe、noscript、nav、footer 等标签
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

  // 2. 提取 body 内容
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let md = bodyMatch ? bodyMatch[1] : cleaned;

  // 3. 去除 HTML 注释
  md = md.replace(/<!--[\s\S]*?-->/g, "");

  // 4. 替换块级标题标签 h1 - h6 为 Markdown # 标题
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // 5. 替换粗体和斜体
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

  // 6. 替换代码块与行内代码
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n");
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // 7. 替换列表项
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n* $1");

  // 8. 替换段落、br 和 div 换行
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, "\n$1\n");

  // 9. 替换超链接和图片
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]( $1 )");

  // 10. 剥离剩余的所有 HTML 标签
  md = md.replace(/<[^>]+>/g, "");

  // 11. 还原常用的 HTML 实体字符
  md = md
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 12. 格式清理：整理换行，避免连续三个及以上换行
  md = md
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return md;
}

function stripMarkdown(md: string): string {
  if (!md) return "";
  let text = md;
  // 1. 移除代码块
  text = text.replace(/```[\s\S]*?```/g, "");
  // 2. 移除行内代码
  text = text.replace(/`([^`]+)`/g, "$1");
  // 3. 移除 Markdown 标题符号
  text = text.replace(/^#+\s+/gm, "");
  // 4. 移除粗体和斜体标记
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  // 5. 移除图片和超链接标记，但保留说明文字
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // 6. 移除列表符号
  text = text.replace(/^\s*[\*\-+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  
  return text.trim();
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
  model = DocConsumerConstants.DEFAULT_EMBEDDING_MODEL
): Promise<number[][]> {
  const batchSize = DocConsumerConstants.EMBEDDING_BATCH_SIZE;
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
// 核心文档处理与辅助拆分方法
// ══════════════════════════════════════════════════

async function extractDocumentContent(
  db: D1Database,
  msg: DocQueueMessage,
  traceId: string
): Promise<{ title: string; content: string }> {
  const { docId, sourceType, sourceUrl, rawContent } = msg;

  if (sourceType === "WEB_SCRAPE" && sourceUrl) {
    TraceLogger.info("DOC_CONSUMER", "FETCHING", traceId, `抓取网页: ${sourceUrl}`);
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SwarmDocBot/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : sourceUrl;

    // 使用高保真清洗算法，将网页 HTML 转换为完备的 Markdown
    const content = htmlToMarkdown(html);

    return { title, content };
  } else if (sourceType === "MANUAL" && rawContent) {
    const doc = await db.prepare("SELECT title FROM documents WHERE id = ?").bind(docId).first<any>();
    const title = doc?.title || "手动录入文档";
    return { title, content: rawContent };
  } else {
    throw new Error(`不支持的文档类型: ${sourceType}`);
  }
}

async function processDocument(
  db: D1Database,
  ai: any,
  msg: DocQueueMessage,
  traceId: string
): Promise<void> {
  const { docId, kbId, sourceType } = msg;

  await updateDocStatus(db, docId, "PROCESSING");
  TraceLogger.info("DOC_CONSUMER", "PROCESSING", traceId, `开始处理文档: docId=${docId}`);

  const { title, content } = await extractDocumentContent(db, msg, traceId);
  if (!content || content.length < 20) throw new Error("文档内容为空或过短");

  const kb = await db.prepare("SELECT chunk_size, chunk_overlap FROM knowledge_bases WHERE id = ?").bind(kbId).first<any>();
  const defaultChunkSize = await ConfigService.getNumber(db, "knowledge.default_chunk_size");
  const defaultChunkOverlap = await ConfigService.getNumber(db, "knowledge.default_chunk_overlap");
  const chunkSize = kb?.chunk_size || defaultChunkSize;
  const chunkOverlap = kb?.chunk_overlap || defaultChunkOverlap;

  // 向量检索切片纯净化：在 Chunks 向量化切片之前，剥离所有 Markdown 格式，以确保向量特征正确
  const cleanContentForEmbedding = stripMarkdown(content);
  const chunks = splitText(cleanContentForEmbedding, chunkSize, chunkOverlap);
  TraceLogger.info("DOC_CONSUMER", "CHUNKED", traceId, `分块完成: ${chunks.length} 个块`);
  if (chunks.length === 0) throw new Error("分块后内容为空");

  const embedModel = await ConfigService.get(db, "knowledge.default_embed_model");
  const texts = chunks.map(c => c.text);
  const vectors = await generateEmbeddings(ai, texts, embedModel);
  TraceLogger.info("DOC_CONSUMER", "EMBEDDED", traceId, `嵌入生成完成: ${vectors.length} 个向量`);

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

  if (sourceType === "WEB_SCRAPE") {
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
    const { docId } = msg.body;
    const traceId = `doc-consumer-${docId}`;

    TraceLogger.info("DOC_CONSUMER", "QUEUE_RECEIVED", traceId, `消费文档处理消息: docId=${docId}`);

    try {
      await processDocument(env.DB, env.AI, msg.body, traceId);
      msg.ack();
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      TraceLogger.error("DOC_CONSUMER", "PROCESS_FAILED", traceId, `文档处理失败: ${errMsg}`, err);

      try {
        await updateDocStatus(env.DB, docId, "FAILED", { errorMessage: errMsg });
      } catch (dbErr: unknown) {
        TraceLogger.error("DOC_CONSUMER", "STATUS_UPDATE_FAILED", traceId, `更新失败状态异常: ${getErrorMessage(dbErr)}`, dbErr);
      }

      if (msg.attempts >= DocConsumerConstants.DEFAULT_MAX_RETRIES) {
        TraceLogger.warn("DOC_CONSUMER", "MAX_RETRIES", traceId, `消息已达最大重试次数: docId=${docId}`);
        msg.ack();
      } else {
        msg.retry({ delaySeconds: DocConsumerConstants.RETRY_DELAY_SECONDS });
      }
    }
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ status: "ok" });
    return new Response("Not Found", { status: 404 });
  },
  queue,
};
