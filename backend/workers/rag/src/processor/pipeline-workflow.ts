import { TraceLogger } from "@swarm/kernel";

/**
 * 文档处理工作流 (DocumentProcessWorkflow)
 *
 * 基于 Cloudflare Workflows 的异步文档处理管道：
 *   fetch_document → chunk_document → generate_embeddings → store_vectors → finalize
 *
 * 每个 step 有独立的重试策略和错误处理，保证管道韧性。
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { splitText } from "./chunker";
import { generateEmbeddings } from "./embedder";
import { VectorStore } from "./vector-store";

export interface Env {
  DB: D1Database;
  AI: any;
  VECTORIZE?: any;
}

export interface Params {
  docId: string;
  kbId: string;
  sourceType: string;
  sourceUrl?: string;
  rawContent?: string;       // 手动录入时直接传入
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

  if (extra.chunkCount !== undefined) {
    sets.push("chunk_count = ?");
    values.push(extra.chunkCount);
  }
  if (extra.title !== undefined) {
    sets.push("title = ?");
    values.push(extra.title);
  }
  if (extra.errorMessage !== undefined) {
    sets.push("error_message = ?");
    values.push(extra.errorMessage);
  }

  values.push(docId);
  await db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}

async function getDoc(db: D1Database, docId: string): Promise<any> {
  const { results } = await db.prepare("SELECT * FROM documents WHERE id = ?").bind(docId).all();
  return results?.[0] || null;
}

/**
 * HTML 内容提取：从 HTML 中提取标题和正文
 */
function extractHtmlContent(html: string): { title: string; text: string } {
  let title = "";
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = titleMatch[1].trim();

  // 移除 script / style / nav / footer / header
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return { title, text: cleaned };
}

// ══════════════════════════════════════════════════
// Workflow 入口
// ══════════════════════════════════════════════════

export class DocumentProcessWorkflow extends WorkflowEntrypoint<Env, Params> {
  declare env: Env;

  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { docId, kbId, sourceType, sourceUrl, rawContent } = event.payload;
    const db = this.env.DB;
    const traceId = `doc-wf-${docId}`;

    TraceLogger.info("RAG", "DOC_WF_START", traceId, `文档处理工作流启动: docId=${docId}, sourceType=${sourceType}`);

    try {
      // ── Step 1: 标记处理中 ──
      await step.do("mark-processing", async () => {
        await updateDocStatus(db, docId, "PROCESSING");
        TraceLogger.info("RAG", "DOC_WF_PROCESSING", traceId, "文档状态已更新为 PROCESSING");
      });

      // ── Step 2: 获取文档内容 ──
      let title: string;
      let content: string;

      if (sourceType === 'WEB_SCRAPE' && sourceUrl) {
        const fetchResult = await step.do("fetch-document", {
          retries: { limit: 3, delay: 5000 },
        }, async () => {
          TraceLogger.info("RAG", "DOC_WF_FETCH", traceId, `正在抓取网页: ${sourceUrl}`);

          const res = await fetch(sourceUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; SwarmKnowledgeBot/1.0)",
            },
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          const html = await res.text();
          if (!html || html.length < 50) {
            throw new Error("页面内容为空或过短");
          }

          return html;
        });

        const extracted = extractHtmlContent(fetchResult);
        title = extracted.title || sourceUrl;
        content = extracted.text;

        if (!content || content.length < 20) {
          throw new Error("页面无可提取的有效文本内容");
        }

      } else if (sourceType === 'MANUAL' && rawContent) {
        title = (await getDoc(db, docId))?.title || "手动录入文档";
        content = rawContent;
      } else {
        throw new Error(`不支持的文档类型或缺少内容: ${sourceType}`);
      }

      // ── Step 3: 分块 ──
      const chunkResult = await step.do("chunk-document", async () => {
        // 读取知识库的 chunk 配置
        const kb = await db
          .prepare("SELECT chunk_size, chunk_overlap FROM knowledge_bases WHERE id = ?")
          .bind(kbId)
          .first<{ chunk_size: number; chunk_overlap: number }>();

        const chunkSize = kb?.chunk_size || 500;
        const chunkOverlap = kb?.chunk_overlap || 100;

        const chunks = splitText(content, chunkSize, chunkOverlap);
        TraceLogger.info("RAG", "DOC_WF_CHUNK", traceId, `分块完成: ${chunks.length} 个块 (size=${chunkSize}, overlap=${chunkOverlap})`);

        return { chunks, title };
      });

      // ── Step 4: 生成嵌入向量 ──
      const embedResult = await step.do("generate-embeddings", {
        retries: { limit: 2, delay: 2000 },
      }, async () => {
        if (!this.env.AI) {
          throw new Error("AI 模型未绑定，无法生成嵌入向量");
        }

        // 将 chunk 转换为 { id, text } 格式
        const chunkInputs = chunkResult.chunks.map(c => ({
          id: `${kbId}:${docId}:${c.index}`,
          text: c.text,
        }));

        const embeddings = await generateEmbeddings(this.env.AI, chunkInputs);
        TraceLogger.info("RAG", "DOC_WF_EMBED", traceId, `嵌入生成完成: ${embeddings.length} 个向量`);

        return { chunkInputs, embeddings };
      });

      // ── Step 5: 写入 Vectorize + D1 ──
      await step.do("store-vectors", {
        retries: { limit: 2, delay: 1000 },
      }, async () => {
        const vectorStore = new VectorStore(this.env.VECTORIZE, db);
        const now = new Date().toISOString();

        // 向量记录
        const vectorRecords = embedResult.embeddings.map(e => ({
          id: e.chunkId,
          values: e.vector,
          metadata: { docId, kbId, chunkIndex: String(chunkResult.chunks.find(c => `${kbId}:${docId}:${c.index}` === e.chunkId)?.index || 0) },
        }));

        await vectorStore.upsert(vectorRecords);

        // 写入 D1 document_chunks
        for (let i = 0; i < chunkResult.chunks.length; i++) {
          const chunk = chunkResult.chunks[i];
          const chunkId = `${kbId}:${docId}:${chunk.index}`;
          await db
            .prepare(
              `INSERT OR REPLACE INTO document_chunks (id, document_id, kb_id, chunk_index, chunk_text, vector_index_id, token_count, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(chunkId, docId, kbId, chunk.index, chunk.text, chunkId, chunk.tokenCount, now)
            .run();
        }

        TraceLogger.info("RAG", "DOC_WF_STORE", traceId, `向量和 chunk 元数据写入完成: ${chunkResult.chunks.length} 条`);
      });

      // ── Step 6: 收尾 ──
      await step.do("finalize", async () => {
        // 更新原文内容到 documents（网页抓取的内容回写）
        if (sourceType === 'WEB_SCRAPE') {
          await db
            .prepare("UPDATE documents SET raw_content = ?, title = ? WHERE id = ?")
            .bind(content, chunkResult.title, docId)
            .run();
        }

        await updateDocStatus(db, docId, "READY", {
          chunkCount: chunkResult.chunks.length,
          title: chunkResult.title,
        });

        TraceLogger.info("RAG", "DOC_WF_COMPLETE", traceId, `文档处理完成: ${chunkResult.chunks.length} 个块`);
      });

    } catch (err: unknown) {
      TraceLogger.error("RAG", "DOC_WF_FAILED", traceId, `文档处理失败: getErrorMessage(err)`, err);
      await updateDocStatus(db, docId, "FAILED", { errorMessage: err.message || "未知错误" });
      throw err;
    }
  }
}

/**
 * 同步处理文档（绕开 Workflow 绑定，直接在当前请求中处理）
 * 适用于小文档，大文档建议使用 Workflow
 */
export async function processDocumentInline(
  env: Env,
  params: Params
): Promise<void> {
  const { docId, kbId, sourceType, sourceUrl, rawContent } = params;
  const db = env.DB;
  const traceId = `doc-inline-${docId}`;

  try {
    TraceLogger.info("RAG", "DOC_INLINE_START", traceId, `同步处理文档: docId=${docId}`);

    // 1. 标记处理中
    await updateDocStatus(db, docId, "PROCESSING");

    // 2. 获取内容
    let title: string;
    let content: string;

    if (sourceType === 'WEB_SCRAPE' && sourceUrl) {
      TraceLogger.info("RAG", "DOC_INLINE_FETCH", traceId, `正在抓取网页: ${sourceUrl}`);
      const res = await fetch(sourceUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SwarmKnowledgeBot/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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

    if (!content || content.length < 20) {
      throw new Error("文档内容为空或过短");
    }

    // 3. 分块
    const { splitText } = await import("./chunker");
    const kb = await db.prepare("SELECT chunk_size, chunk_overlap FROM knowledge_bases WHERE id = ?").bind(kbId).first<any>();
    const chunkSize = kb?.chunk_size || 500;
    const chunkOverlap = kb?.chunk_overlap || 100;
    const chunks = splitText(content, chunkSize, chunkOverlap);
    TraceLogger.info("RAG", "DOC_INLINE_CHUNK", traceId, `分块完成: ${chunks.length} 个块`);

    // 4. 生成嵌入
    if (!env.AI) throw new Error("AI 绑定不可用");
    const { generateEmbeddings } = await import("./embedder");
    const chunkInputs = chunks.map(c => ({ id: `${kbId}:${docId}:${c.index}`, text: c.text }));
    const embeddings = await generateEmbeddings(env.AI, chunkInputs);

    // 5. 写入 D1 + Vectorize
    const { VectorStore } = await import("./vector-store");
    const vectorStore = new VectorStore(undefined, db);
    const now = new Date().toISOString();
    const vectorRecords = embeddings.map(e => ({ id: e.chunkId, values: e.vector }));
    await vectorStore.upsert(vectorRecords);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${kbId}:${docId}:${chunk.index}`;
      await db
        .prepare("INSERT OR REPLACE INTO document_chunks (id, document_id, kb_id, chunk_index, chunk_text, vector_index_id, token_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(chunkId, docId, kbId, chunk.index, chunk.text, chunkId, chunk.tokenCount, now)
        .run();
    }

    // 6. 更新状态
    if (sourceType === 'WEB_SCRAPE') {
      await db.prepare("UPDATE documents SET raw_content = ?, title = ? WHERE id = ?").bind(content, title, docId).run();
    }
    await updateDocStatus(db, docId, "READY", { chunkCount: chunks.length, title });

    TraceLogger.info("RAG", "DOC_INLINE_COMPLETE", traceId, `同步处理完成: ${chunks.length} 个块`);
  } catch (err: unknown) {
    TraceLogger.error("RAG", "DOC_INLINE_FAILED", traceId, `同步处理失败: getErrorMessage(err)`, err);
    await updateDocStatus(db, docId, "FAILED", { errorMessage: err.message || "未知错误" });
  }
}
