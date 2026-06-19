/**
 * 智能中文分块器 (Recursive Character Text Splitter)
 *
 * 按 段落 → 句子 → 固定长度 递归分割，兼顾语义完整性和 Token 预算。
 */

import { RAG_DEFAULT_CHUNK_SIZE, RAG_DEFAULT_CHUNK_OVERLAP } from "@swarm/shared";

export interface ChunkResult {
  index: number;
  text: string;
  tokenCount: number;
}

/**
 * 递归分割文本
 */
export function splitText(
  text: string,
  chunkSize: number = RAG_DEFAULT_CHUNK_SIZE,
  chunkOverlap: number = RAG_DEFAULT_CHUNK_OVERLAP
): ChunkResult[] {
  if (!text || text.trim().length === 0) return [];

  // 去除多余空白
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length === 0) return [];

  const chunks: ChunkResult[] = [];

  // 1. 按段落分割（双换行）
  const paragraphs = splitByParagraphs(cleaned);

  // 2. 段落合并到 chunk
  let currentChunk = "";
  let currentTokens = 0;

  function flushChunk(text: string): void {
    if (text.trim().length === 0) return;
    chunks.push({
      index: chunks.length,
      text: text.trim(),
      tokenCount: estimateTokens(text.trim()),
    });
  }

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // 如果单个段落就超过 chunk_size，需要进一步拆分
    if (paraTokens > chunkSize) {
      // 先 flush 当前缓存
      if (currentChunk) {
        flushChunk(currentChunk);
        currentChunk = "";
        currentTokens = 0;
      }
      // 再拆分大段落
      const subChunks = splitLargeParagraph(para, chunkSize, chunkOverlap);
      for (const sc of subChunks) {
        flushChunk(sc);
      }
      continue;
    }

    // 加上当前段落会超 chunk_size，先 flush
    if (currentTokens + paraTokens > chunkSize) {
      flushChunk(currentChunk);
      // 带 overlap：保留上一个 chunk 末尾的内容
      const overlapText = extractOverlap(currentChunk, chunkOverlap);
      currentChunk = overlapText + (overlapText ? "\n" : "") + para;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? "\n" : "") + para;
      currentTokens += paraTokens + 1; // +1 for newline
    }
  }

  // 最后一个 chunk
  if (currentChunk.trim()) {
    flushChunk(currentChunk);
  }

  return chunks;
}

/**
 * 按段落分割（双换行 → \n 分割）
 */
function splitByParagraphs(text: string): string[] {
  const parts = text.split(/\n\n+/);
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * 拆分超长段落：按句子分界 → 固定长度
 */
function splitLargeParagraph(text: string, chunkSize: number, chunkOverlap: number): string[] {
  // 中文/英文句子分割
  const sentences = text
    .split(/(?<=[。！？.!?\n])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length <= 1) {
    // 无法按句子分割，直接按字符切
    return splitByChar(text, chunkSize, chunkOverlap);
  }

  const result: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);
    if (current.length + sentence.length > chunkSize) {
      if (current) result.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) result.push(current.trim());

  return result;
}

/**
 * 按字符数分割（兜底方案）
 */
function splitByChar(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const result: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    result.push(text.slice(start, end).trim());
    start = end - chunkOverlap;
  }
  return result.filter(s => s.length > 0);
}

/**
 * 提取当前 chunk 末尾的内容作为 overlap
 */
function extractOverlap(text: string, overlapChars: number): string {
  if (!text || overlapChars <= 0) return "";
  return text.slice(-overlapChars);
}

/**
 * 估算 Token 数（中文字符 1.5 token，其他 0.25 token）
 */
export function estimateTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    if (ch >= '\u4e00' && ch <= '\u9fff') {
      tokens += 1.5;
    } else {
      tokens += 0.25;
    }
  }
  return Math.ceil(tokens);
}
