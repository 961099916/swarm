// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/controllers/rag.controller.ts

import { ApiRes, TraceLogger, getErrorMessage } from "@swarm/kernel";
import { RagService } from "../services/rag.service";
import { RAG_DEFAULT_TOP_K } from "@swarm/knowledge";

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

  public async searchKnowledge(request: Request, userId: string, traceId: string): Promise<Response> {
    try {
      const body = await request.json() as { kbId?: string; query?: string; topK?: number };
      if (!body.kbId || !body.query) {
        return ApiRes.badRequest("缺少必填参数 kbId 或 query", traceId);
      }

      const topK = body.topK || RAG_DEFAULT_TOP_K;
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
}
