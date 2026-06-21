// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/retriever/context-injector.ts
import { TraceLogger, getErrorMessage } from "@swarm/kernel";

/**
 * RAG 上下文注入器
 *
 * 供 Workflow 内部调用，负责：
 * 1. Supervisor 决策时通过 QUERY_KNOWLEDGE 检索知识库
 * 2. Agent 执行前自动注入 RAG 上下文
 *
 * 通过 Service Binding 调用 RAG Worker，保持松耦合。
 */

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

/**
 * 通过 Service Binding 调用 RAG Worker 获取上下文
 */
export async function fetchRAGContext(
  ragBinding: Fetcher | undefined,
  kbIds: string[],
  query: string,
  maxChunks: number = 5,
  minScore: number = 0.4
): Promise<RAGInjectResult> {
  const emptyResult: RAGInjectResult = { context: "", chunks: [] };

  if (!ragBinding || kbIds.length === 0 || !query) {
    return emptyResult;
  }

  try {
    const response = await ragBinding.fetch("http://internal/rag/inject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kbIds,
        query,
        maxChunks,
        minScore,
      }),
    });

    if (!response.ok) {
      TraceLogger.warn("RAG", "INJECTOR", "WORKFLOW", `RAG 上下文注入 HTTP ${response.status}`);
      return emptyResult;
    }

    const result = await response.json() as any;
    if (result.success && result.data) {
      return result.data as RAGInjectResult;
    }

    return emptyResult;
  } catch (err: unknown) {
    TraceLogger.warn("RAG", "INJECTOR_FAILED", "WORKFLOW", `RAG 上下文注入调用失败: ${getErrorMessage(err)}`);
    return emptyResult;
  }
}

/**
 * 将 RAG context 组装到 Agent system prompt 末尾
 */
export function injectContextToPrompt(
  originalPrompt: string,
  ragContext: string,
  maxContextLength: number = 3000
): string {
  if (!ragContext || ragContext.trim().length === 0) {
    return originalPrompt;
  }

  // 截断过长的上下文
  const truncatedContext = ragContext.length > maxContextLength
    ? ragContext.slice(0, maxContextLength) + "\n...(上下文已截断)"
    : ragContext;

  return `${originalPrompt}\n\n## 参考知识\n${truncatedContext}\n\n请优先使用上述参考知识来回答用户问题。如果参考知识中不包含相关信息，则使用你自己的知识回答。`;
}

/**
 * 组装 Supervisor 需要查询的知识库（从用户配置或默认）
 */
export function getDefaultKnowledgeBaseIds(payload: any): string[] {
  // 从任务 payload 中读取配置 of 知识库 ID
  if (payload?.knowledgeBaseIds && Array.isArray(payload.knowledgeBaseIds)) {
    return payload.knowledgeBaseIds;
  }
  return [];
}
