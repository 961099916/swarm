import { TraceLogger } from "@swarm/kernel";
import { RAG_EMBED_PASSAGE_PREFIX, RAG_MAX_CONCURRENT_EMBEDDINGS } from "@swarm/knowledge";

/**
 * 嵌入生成器
 *
 * 通过 Workers AI 生成文本嵌入向量，支持批量并发和 e5 模型前缀处理。
 */

const DEFAULT_EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";

export interface EmbeddingResult {
  vector: number[];
  chunkId: string;
}

/**
 * 批量生成嵌入向量
 * @param ai Workers AI binding
 * @param chunks 待嵌入的文本列表（含 chunkId）
 * @param model 嵌入模型名
 * @returns 嵌入向量列表
 */
export async function generateEmbeddings(
  ai: any,
  chunks: Array<{ id: string; text: string }>,
  model: string = DEFAULT_EMBED_MODEL
): Promise<EmbeddingResult[]> {
  if (!ai) {
    TraceLogger.error("RAG", "EMBEDDING", "SYSTEM", "AI 绑定不可用，无法生成嵌入");
    throw new Error("AI 模型不可用");
  }

  const results: EmbeddingResult[] = [];

  // 分批并发执行
  for (let i = 0; i < chunks.length; i += RAG_MAX_CONCURRENT_EMBEDDINGS) {
    const batch = chunks.slice(i, i + RAG_MAX_CONCURRENT_EMBEDDINGS);
    const batchResults = await processBatch(ai, batch, model);
    results.push(...batchResults);
  }

  TraceLogger.info("RAG", "EMBEDDING", "SYSTEM", `嵌入生成完成: ${results.length}/${chunks.length} 个向量`);
  return results;
}

async function processBatch(
  ai: any,
  batch: Array<{ id: string; text: string }>,
  model: string
): Promise<EmbeddingResult[]> {
  // e5 模型要求 passage 前缀
  const prefixedTexts = batch.map(c => `${RAG_EMBED_PASSAGE_PREFIX}${c.text}`);

  const res = await ai.run(model, {
    text: prefixedTexts,
  });

  const vectors: number[][] = res?.data || [];

  if (vectors.length !== batch.length) {
    TraceLogger.warn("RAG", "EMBEDDING", "SYSTEM",
      `嵌入返回数量不匹配: 期望 ${batch.length}，实际 ${vectors.length}`);
  }

  return batch.map((chunk, idx) => ({
    vector: vectors[idx] || [],
    chunkId: chunk.id,
  }));
}
