// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/services/ai.ts

import { AIClient } from "@swarm/ai-gateway";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";
import { appendTaskLog } from "../utils";
import { WorkflowConstants } from "../constants/workflow.constant";

/**
 * 映射获取受支持的底座模型名称
 */
export function getSupportedModel(model: string | undefined): string {
  const m = model ? model.trim() : "";
  if (!m || m.includes("llama-3.2-3b") || m.includes("llama-3-8b") || m.includes("llama-3.1-8b-instruct")) {
    return WorkflowConstants.DEFAULT_MODEL;
  }
  return m;
}

/**
 * 限制上下文单条输入大小，防止撑爆大模型 Token Window
 */
export function truncateContent(content: string, maxLen = 1000): string {
  if (!content) return "";
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + "\n... [由于该节点返回内容过长，已由工作流系统自动截断，以节省大模型 Token 资源]";
}

/**
 * 统一大模型通信及日志审计
 */
export async function callLlmChatAndLog(
  ai: any,
  db: D1Database,
  taskId: string,
  agentName: string,
  messages: Array<{ role: string; content: string }>,
  model: string | undefined,
  agentModelConfigId?: string,
  agentId?: string,
  queue?: any
): Promise<string> {
  if (!ai) throw new Error("Cloudflare AI 实例未绑定");
  const rawModel = model || WorkflowConstants.DEFAULT_MODEL;
  const mappedModel = getSupportedModel(rawModel);
  
  const startTime = Date.now();
  let responseText = "";
  let errorMsg: string | undefined = undefined;
  let success = true;
  
  try {
    try {
      const aiClient = new AIClient({ AI: ai, DB: db, LOG_QUEUE: queue });
      const result = await aiClient.chat({
        modelConfigId: agentModelConfigId,
        messages: messages,
        traceId: taskId,
        taskId,
        agentId,
      });
      responseText = result.content;
    } catch (aiClientErr: unknown) {
      const errMsg = aiClientErr instanceof Error ? aiClientErr.message : String(aiClientErr);
      TraceLogger.warn("WORKFLOW", "AI_CLIENT_FALLBACK", taskId, `AIClient 调用失败，降级到原生 AI: ${errMsg}`);
      const res = await ai.run(mappedModel, { messages });
      responseText = res.response || "";
    }

    if (!responseText) {
      throw new Error("大模型响应内容为空");
    }
    return responseText;
  } catch (err: unknown) {
    success = false;
    errorMsg = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const latencyMs = Date.now() - startTime;
    const logPayload = {
      type: "AI_CHAT_LOG",
      agentName,
      model: mappedModel,
      messages,
      response: responseText,
      success,
      error: errorMsg,
      latencyMs
    };

    try {
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[AI_CHAT] ${JSON.stringify(logPayload)}`, queue);
      
      if (success) {
        TraceLogger.info(
          "WORKFLOW",
          "AI_CHAT_CALL",
          taskId,
          `智能体 ${agentName} 调用大模型成功，耗时 ${latencyMs}ms`,
          undefined,
          {
            model: mappedModel,
            promptTokens: -1,
            completionTokens: -1,
            latencyMs
          }
        );
      } else {
        TraceLogger.error(
          "WORKFLOW",
          "AI_CHAT_CALL",
          taskId,
          `智能体 ${agentName} 调用大模型失败，耗时 ${latencyMs}ms: ${errorMsg}`,
          errorMsg ? new Error(errorMsg) : undefined,
          undefined,
          {
            model: mappedModel,
            promptTokens: -1,
            completionTokens: -1,
            latencyMs
          }
        );
      }
    } catch (dbErr: unknown) {
      TraceLogger.error("WORKFLOW", "LOG_WRITE_FAILED", taskId, `写入 AI 交互日志失败: ${getErrorMessage(dbErr)}`, dbErr);
    }
  }
}
