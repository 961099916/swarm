// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/controllers/rag.controller.ts

import { ApiRes, TraceLogger, getErrorMessage } from "@swarm/kernel";
import { RagService } from "../services/rag.service";
import { KnowledgeConfig } from "@swarm/knowledge";

export class RagController {
  constructor(private ragService: RagService) {}

  public async getKBs(request: Request, userId: string, userRole: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.ragService.getKBs(url, userId, userRole);
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("系统获取知识库列表异常", traceId);
    }
  }

  public async createKB(request: Request, userId: string, traceId: string): Promise<Response> {
    try {
      const body = await request.json();
      const kbId = await this.ragService.createKB(userId, body);
      return ApiRes.success({ kbId }, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "MISSING_KB_NAME") return ApiRes.badRequest("缺少必填参数: name", traceId);
      return ApiRes.internalError("系统创建知识库异常", traceId);
    }
  }

  public async updateKB(request: Request, kbId: string, userId: string, userRole: string, traceId: string): Promise<Response> {
    try {
      const body = await request.json();
      await this.ragService.updateKB(kbId, userId, userRole, body);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "KB_NOT_FOUND") return ApiRes.error(1030, "知识库不存在", traceId);
      if (msg === "PERMISSION_DENIED") return ApiRes.forbidden("权限不足", traceId);
      return ApiRes.internalError("系统修改知识库异常", traceId);
    }
  }

  public async deleteKB(kbId: string, userId: string, userRole: string, traceId: string): Promise<Response> {
    try {
      await this.ragService.deleteKB(kbId, userId, userRole);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "KB_NOT_FOUND") return ApiRes.error(1030, "知识库不存在", traceId);
      if (msg === "PERMISSION_DENIED") return ApiRes.forbidden("权限不足", traceId);
      return ApiRes.internalError("系统删除知识库异常", traceId);
    }
  }

  public async getDocuments(request: Request, kbId: string, userId: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.ragService.getDocuments(kbId, url, userId);
      return ApiRes.success(list, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "PERMISSION_DENIED") return ApiRes.forbidden("权限不足", traceId);
      return ApiRes.internalError("系统查询文档异常", traceId);
    }
  }

  public async deleteDocument(docId: string, userId: string, userRole: string, traceId: string): Promise<Response> {
    try {
      await this.ragService.deleteDocument(docId, userId, userRole);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "DOC_NOT_FOUND") return ApiRes.error(1030, "文档不存在", traceId);
      if (msg === "PERMISSION_DENIED") return ApiRes.forbidden("权限不足", traceId);
      return ApiRes.internalError("系统下线文档异常", traceId);
    }
  }

  public async searchKnowledge(request: Request, db: D1Database, userId: string, traceId: string): Promise<Response> {
    try {
      const body = await request.json() as { kbId?: string; query?: string; topK?: number };
      if (!body.kbId || !body.query) {
        return ApiRes.badRequest("缺少必填参数 kbId 或 query", traceId);
      }

      const defaultTopK = await KnowledgeConfig.getDefaultTopK(db);
      const topK = body.topK || defaultTopK;
      const results = await this.ragService.keywordSearch(body.kbId, body.query, topK, traceId);

      TraceLogger.info("RAG", "SEARCH_RESULTS", traceId, `知识库搜索完成: kbId=${body.kbId}, 结果数=${results.length}`, userId);
      return ApiRes.success({ results, totalChunks: results.length }, traceId);
    } catch (err) {
      TraceLogger.error("RAG", "SEARCH_FAILED", traceId, `知识库搜索异常: ${getErrorMessage(err)}`, err);
      return ApiRes.internalError("知识检索失败", traceId);
    }
  }

  public async injectContext(request: Request, traceId: string): Promise<Response> {
    try {
      const body = await request.json() as { kbIds?: string[]; query?: string; maxChunks?: number };
      if (!body.kbIds || body.kbIds.length === 0 || !body.query) {
        return ApiRes.badRequest("缺少必填参数 kbIds 或 query", traceId);
      }

      const maxChunks = body.maxChunks || 5;
      const data = await this.ragService.injectRAGContext(body.kbIds, body.query, maxChunks, traceId);
      return ApiRes.success(data, traceId);
    } catch (err) {
      TraceLogger.error("RAG", "CONTEXT_INJECT_FAILED", traceId, `RAG 上下文注入异常: ${getErrorMessage(err)}`, err);
      return ApiRes.success({ context: "", chunks: [] }, traceId);
    }
  }

  public async addDocumentByUrl(request: Request, docQueue: any, userId: string, traceId: string): Promise<Response> {
    try {
      const body = await request.json();
      const docId = await this.ragService.addDocumentByUrl({ userId, body, docQueue, traceId });
      return ApiRes.success({ docId, message: "文档已提交，后台正在处理中" }, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "MISSING_PARAMS" || msg === "EMPTY_URL") return ApiRes.badRequest("缺少必填参数 kbId 或 url", traceId);
      if (msg === "PERMISSION_DENIED") return ApiRes.forbidden("权限不足", traceId);
      return ApiRes.internalError("添加文档失败", traceId);
    }
  }

  public async addDocumentManual(request: Request, docQueue: any, userId: string, traceId: string): Promise<Response> {
    try {
      const body = await request.json();
      const docId = await this.ragService.addDocumentManual({ userId, body, docQueue, traceId });
      return ApiRes.success({ docId, message: "文档已提交，后台正在处理中" }, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "MISSING_PARAMS") return ApiRes.badRequest("缺少必填参数 kbId、title 或 content", traceId);
      if (msg === "PERMISSION_DENIED") return ApiRes.forbidden("权限不足", traceId);
      return ApiRes.internalError("添加文档失败", traceId);
    }
  }

  public async getKBsDirect(traceId: string): Promise<Response> {
    try {
      const list = await this.ragService.getKBs(new URL("http://internal/"), "system", "ADMIN");
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("系统获取知识库列表异常", traceId);
    }
  }

  public async getGlobalDocuments(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.ragService.getGlobalDocuments(url);
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("系统获取全局文档失败", traceId);
    }
  }

  public async chatKnowledge(
    request: Request,
    ai: any,
    userId: string,
    traceId: string
  ): Promise<Response> {
    try {
      if (!ai) {
        TraceLogger.error("RAG", "AI_BINDING_MISSING", traceId, "Cloudflare AI 实例未绑定");
        return ApiRes.internalError("AI 问答模块不可用", traceId);
      }

      const body = await request.json() as { kbId?: string; query?: string; history?: Array<{ role: string; content: string }> };
      if (!body.kbId || !body.query) {
        return ApiRes.badRequest("缺少必填参数 kbId 或 query", traceId);
      }

      // 1. 语义和关键字混合检索知识库
      const topK = 5;
      let results: any[] = [];
      let context = "";
      try {
        results = await this.ragService.keywordSearch(body.kbId, body.query, topK, traceId);
        if (results && results.length > 0) {
          context = results.map((r, i) => `[参考 ${i + 1}] (来自《${r.documentTitle}》):\n${r.content}`).join("\n\n");
        }
      } catch (searchErr: any) {
        TraceLogger.warn("RAG", "SEARCH_FAILED_FALLBACK", traceId, `语义检索失败，降级为无参考问答: ${searchErr.message}`);
      }

      // 2. 组装 RAG 系统 Prompt 约束模型，避免幻觉
      const systemPrompt = `你是一个专业且耐心的知识库问答助手。
请根据以下提供的【参考内容】回答用户提出的问题。
如果从【参考内容】中无法找到相关答案，请直接、委婉地告诉用户“抱歉，在知识库中未找到关于该问题的相关参考内容”，绝对不能凭空编造、捏造事实或提供与参考内容冲突的回答。

【参考内容】:
${context || "暂无相关参考文档"}
`;

      const modelMessages = [
        { role: "system", content: systemPrompt }
      ];

      // 装载历史对话
      if (body.history && Array.isArray(body.history)) {
        for (const h of body.history) {
          if (h.role && h.content) {
            modelMessages.push({ role: h.role, content: h.content });
          }
        }
      }

      // 装载当前提问
      modelMessages.push({ role: "user", content: body.query });

      // 3. 构建可双工异步写入的合并流，优先发送 sources 信息
      const model = "@cf/meta/llama-3.1-8b-instruct-fp8";
      TraceLogger.info("RAG", "AI_CHAT_STREAM_START", traceId, `启动大模型流式生成: model=${model}, kbId=${body.kbId}`, userId);

      const encoder = new TextEncoder();
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      // 异步执行流写入，防主线程阻塞
      (async () => {
        try {
          // 发送参考的文档来源数组，供前端呈现“参考文档：[A, B]”
          const sources = [...new Set(results.map((r: any) => r.documentTitle))];
          await writer.write(encoder.encode(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`));

          // 触发大模型流
          const responseStream = await ai.run(model, {
            messages: modelMessages,
            stream: true,
          });

          // 逐个分片合并读取并写入输出流
          const reader = responseStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }

          // 发送 DONE 信号
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (err: any) {
          TraceLogger.error("RAG", "ASYNC_STREAM_WRITE_FAILED", traceId, `流异步写入失败: ${err.message}`, err);
          await writer.write(encoder.encode(`event: error\ndata: ${err.message || "流写入错误"}\n\n`));
        } finally {
          await writer.close();
        }
      })();

      // 4. 返回 Event Stream 响应
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });

    } catch (err: any) {
      TraceLogger.error("RAG", "CHAT_FAILED", traceId, `知识库流式问答崩溃: ${err.message}`, err);
      return ApiRes.internalError("知识问答服务异常，请稍后重试", traceId);
    }
  }
}


