/**
 * AI Gateway 统一客户端
 *
 * 封装所有 AI 调用（LLM 推理），提供：
 * - AI Gateway 代理（日志/缓存/限流/分析）
 * - 动态模型路由（基于 model_configs 表）
 * - 用户级速率限制
 * - 调用日志记录（ai_call_logs 表）
 * - Cloudflare AI binding 降级兜底
 */

import {
  AIChatRequest, AIChatResponse,
  AIEmbedRequest, AIEmbedResponse,
  ModelConfigRow,
  AI_CHAT_TIMEOUT_MS, AI_EMBED_TIMEOUT_MS,
  AI_DEFAULT_RPM, AI_DEFAULT_TPM,
} from "./types";
import { TraceLogger } from "./logger";

const EMPTY_EMBEDDING: number[][] = [];

/**
 * Workers AI 调用接口（env.AI.run 的类型）
 */
interface WorkersAIBinding {
  run(model: string, input: any): Promise<{ response?: string; data?: number[][] }>;
}

/**
 * AIClient 环境依赖
 */
export interface AIClientEnv {
  /** 原生 Workers AI binding */
  AI?: WorkersAIBinding;
  /** D1 数据库 */
  DB: D1Database;
  /** KV 缓存 */
  KV?: KVNamespace;
}

// ══════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════

function estimateTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    if (ch >= '\u4e00' && ch <= '\u9fff') tokens += 1.5;
    else tokens += 0.25;
  }
  return Math.ceil(tokens);
}

function estimateChatTokens(messages: Array<{ role: string; content: string }>): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0) + messages.length * 4;
}

function estimateCost(model: ModelConfigRow, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1000) * model.cost_per_1k_input + (outputTokens / 1000) * model.cost_per_1k_output;
}

// ══════════════════════════════════════════════════
// AIClient 主类
// ══════════════════════════════════════════════════

export class AIClient {
  constructor(private env: AIClientEnv) {}

  /**
   * 聊天补全
   */
  async chat(req: AIChatRequest): Promise<AIChatResponse> {
    const startTime = Date.now();
    const traceId = req.traceId;

    const modelConfig = await this.resolveModelConfig(req.modelConfigId, 'CHAT');
    if (!modelConfig) {
      return this.fallbackChat(req, startTime);
    }

    if (req.userId) {
      const allowed = await this.checkRateLimit(req.userId, 'CHAT', modelConfig);
      if (!allowed) {
        TraceLogger.warn("AI_GATEWAY", "RATE_LIMITED", traceId, `用户 ${req.userId} CHAT 速率受限`);
        await this.logCall({
          traceId, purpose: 'CHAT', provider: modelConfig.provider,
          modelName: modelConfig.model_name, userId: req.userId, agentId: req.agentId, taskId: req.taskId,
          inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startTime,
          status: 'RATE_LIMITED', errorMessage: '速率限制', costUsd: 0
        });
        throw new AIClientError('请求过于频繁，请稍后重试', 'RATE_LIMITED');
      }
    }

    try {
      const result = await this.callChatModel(modelConfig, req, startTime);
      return result;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      TraceLogger.error("AI_GATEWAY", "CHAT_FAILED", traceId, `模型调用失败: ${err.message}`, err);
      await this.logCall({
        traceId, purpose: 'CHAT', provider: modelConfig.provider,
        modelName: modelConfig.model_name, userId: req.userId, agentId: req.agentId, taskId: req.taskId,
        inputTokens: 0, outputTokens: 0, latencyMs,
        status: 'FAILED', errorMessage: err.message, costUsd: 0
      });
      return this.fallbackChat(req, startTime);
    }
  }

  /**
   * 文本嵌入（仅通过 Workers AI，不走 Gateway）
   */
  async embed(req: AIEmbedRequest): Promise<AIEmbedResponse> {
    const startTime = Date.now();
    const traceId = req.traceId;

    const modelConfig = await this.resolveModelConfig(req.modelConfigId, 'EMBEDDING');
    if (!modelConfig) {
      return this.fallbackEmbed(req, startTime);
    }

    if (req.userId) {
      const allowed = await this.checkRateLimit(req.userId, 'EMBEDDING', modelConfig);
      if (!allowed) {
        await this.logCall({
          traceId, purpose: 'EMBEDDING', provider: modelConfig.provider,
          modelName: modelConfig.model_name, userId: req.userId, kbId: req.kbId, taskId: req.taskId,
          inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startTime,
          status: 'RATE_LIMITED', errorMessage: '速率限制', costUsd: 0
        });
        throw new AIClientError('嵌入请求过于频繁，请稍后重试', 'RATE_LIMITED');
      }
    }

    try {
      return await this.callEmbedModel(modelConfig, req, startTime);
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      TraceLogger.error("AI_GATEWAY", "EMBED_FAILED", traceId, `嵌入调用失败: ${err.message}`, err);
      await this.logCall({
        traceId, purpose: 'EMBEDDING', provider: modelConfig.provider,
        modelName: modelConfig.model_name, userId: req.userId, kbId: req.kbId, taskId: req.taskId,
        inputTokens: 0, outputTokens: 0, latencyMs,
        status: 'FAILED', errorMessage: err.message, costUsd: 0
      });
      return this.fallbackEmbed(req, startTime);
    }
  }

  // ──────────────────────────────────────────────
  // 私有方法
  // ──────────────────────────────────────────────

  private async resolveModelConfig(modelConfigId: string | undefined, purpose: string): Promise<ModelConfigRow | null> {
    try {
      if (modelConfigId) {
        const { results } = await this.env.DB
          .prepare("SELECT * FROM model_configs WHERE id = ? AND is_active = 1")
          .bind(modelConfigId)
          .all<any>();
        if (results && results.length > 0) return results[0] as ModelConfigRow;
      }
      const { results } = await this.env.DB
        .prepare("SELECT * FROM model_configs WHERE purpose = ? AND is_default = 1 AND is_active = 1 LIMIT 1")
        .bind(purpose)
        .all<any>();
      if (results && results.length > 0) return results[0] as ModelConfigRow;
      return null;
    } catch (err) {
      TraceLogger.error("AI_GATEWAY", "RESOLVE_MODEL_FAILED", "SYSTEM", `解析模型配置异常: ${err}`);
      return null;
    }
  }

  private async checkRateLimit(userId: string, purpose: string, config: ModelConfigRow): Promise<boolean> {
    try {
      const now = new Date();
      const bucket = now.toISOString().slice(0, 16).replace('T', 'T');
      await this.env.DB
        .prepare(`INSERT INTO user_rate_limits (user_id, purpose, minute_bucket, call_count, token_count) VALUES (?, ?, ?, 1, 0) ON CONFLICT(user_id, purpose, minute_bucket) DO UPDATE SET call_count = call_count + 1`)
        .bind(userId, purpose, bucket)
        .run();
      const { results } = await this.env.DB
        .prepare("SELECT call_count FROM user_rate_limits WHERE user_id = ? AND purpose = ? AND minute_bucket = ?")
        .bind(userId, purpose, bucket)
        .all<any>();
      const count = results?.[0]?.call_count || 0;
      return count <= (config.rate_limit_rpm || AI_DEFAULT_RPM);
    } catch (err) {
      return true;
    }
  }

  /**
   * 调用聊天模型（优先 AI Gateway SDK）
   */
  private async callChatModel(
    config: ModelConfigRow,
    req: AIChatRequest,
    startTime: number
  ): Promise<AIChatResponse> {
    const traceId = req.traceId;
    const messages = [
      { role: "system", content: req.systemPrompt },
      ...req.messages,
    ];
    const inputTokens = estimateChatTokens(messages);

    if (!this.env.AI) throw new AIClientError('AI 模型不可用', 'NO_BINDING');

    // 通过 Workers AI 调用（传递 gateway 参数走 AI Gateway，自动记录日志）
    const res = await this.env.AI.run(config.model_name, { messages }, {
      gateway: { id: "swarm-ai-gateway" },
    });
    const content = res.response || "";
    if (!content) throw new Error("AI 返回内容为空");
    const outputTokens = estimateTokens(content);
    const latencyMs = Date.now() - startTime;
    const costUsd = estimateCost(config, inputTokens, outputTokens);

    await this.logCall({
      traceId, purpose: 'CHAT', provider: 'workers-ai',
      modelName: config.model_name, userId: req.userId, agentId: req.agentId, taskId: req.taskId,
      inputTokens, outputTokens, latencyMs, status: 'SUCCESS', costUsd
    });

    return {
      content, modelConfigId: config.id, provider: 'workers-ai',
      modelName: config.model_name, inputTokens, outputTokens, latencyMs, costUsd
    };
  }

  /**
   * 调用嵌入模型
   */
  private async callEmbedModel(
    config: ModelConfigRow,
    req: AIEmbedRequest,
    startTime: number
  ): Promise<AIEmbedResponse> {
    const inputs = typeof req.input === 'string' ? [req.input] : req.input;
    const inputTokens = inputs.reduce((sum, t) => sum + estimateTokens(t), 0);

    if (!this.env.AI) {
      throw new AIClientError('嵌入模型不可用', 'NO_BINDING');
    }

    const res = await this.env.AI.run(config.model_name, { text: inputs });
    const embeddings = res.data || EMPTY_EMBEDDING;
    const latencyMs = Date.now() - startTime;
    const costUsd = estimateCost(config, inputTokens, 0);

    await this.logCall({
      traceId, purpose: 'EMBEDDING', provider: config.provider,
      modelName: config.model_name, userId: req.userId, kbId: req.kbId, taskId: req.taskId,
      inputTokens, outputTokens: 0, latencyMs, status: 'SUCCESS', costUsd
    });

    return { embeddings, modelConfigId: config.id, provider: config.provider as any, modelName: config.model_name, latencyMs, costUsd };
  }

  /**
   * 兜底：直接用 Workers AI 原始 binding
   */
  private async fallbackChat(req: AIChatRequest, startTime: number): Promise<AIChatResponse> {
    if (!this.env.AI) throw new AIClientError('AI 模型不可用', 'NO_BINDING');
    const model = "@cf/meta/llama-3.1-8b-instruct-fp8";
    const messages = [{ role: "system", content: req.systemPrompt }, ...req.messages];
    const res = await this.env.AI.run(model, { messages });
    const content = res.response || "";
    const latencyMs = Date.now() - startTime;
    return { content, modelConfigId: 'fallback', provider: 'workers-ai', modelName: model, inputTokens: 0, outputTokens: 0, latencyMs, costUsd: 0 };
  }

  private async fallbackEmbed(req: AIEmbedRequest, startTime: number): Promise<AIEmbedResponse> {
    if (!this.env.AI) throw new AIClientError('嵌入模型不可用', 'NO_BINDING');
    const model = "@cf/baai/bge-small-en-v1.5";
    const inputs = typeof req.input === 'string' ? [req.input] : req.input;
    const res = await this.env.AI.run(model, { text: inputs });
    const latencyMs = Date.now() - startTime;
    return { embeddings: res.data || EMPTY_EMBEDDING, modelConfigId: 'fallback', provider: 'workers-ai', modelName: model, latencyMs, costUsd: 0 };
  }

  /**
   * 异步记录 AI 调用日志
   */
  private async logCall(params: {
    traceId: string; purpose: string; provider: string; modelName: string;
    userId?: string; agentId?: string; taskId?: string; kbId?: string;
    inputTokens: number; outputTokens: number; latencyMs: number;
    status: string; errorMessage?: string; costUsd: number;
  }): Promise<void> {
    try {
      await this.env.DB
        .prepare(
          `INSERT INTO ai_call_logs (trace_id, purpose, provider, model_name, user_id, agent_id, task_id, kb_id, input_tokens, output_tokens, latency_ms, status, error_message, cost_usd, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          params.traceId, params.purpose, params.provider, params.modelName,
          params.userId || null, params.agentId || null, params.taskId || null, params.kbId || null,
          params.inputTokens, params.outputTokens, params.latencyMs,
          params.status, params.errorMessage || null, params.costUsd,
          new Date().toISOString()
        )
        .run();
    } catch (err) {
      TraceLogger.warn("AI_GATEWAY", "LOG_WRITE_FAILED", params.traceId, `写入 AI 调用日志失败: ${err}`);
    }
  }
}

export class AIClientError extends Error {
  constructor(message: string, public code: 'RATE_LIMITED' | 'NO_BINDING' | 'MODEL_FAILED') {
    super(message);
    this.name = 'AIClientError';
  }
}
