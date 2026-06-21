/**
 * @swarm/ai-gateway — AI 推理网关限界上下文
 *
 * Bounded Context (DDD): 模型路由配置、速率限制、调用日志、AI 客户端封装
 * Aggregate Roots: ModelConfig (模型配置聚合)
 */

export { modelConfigs, aiCallLogs, userRateLimits } from './schema';
export type {
  ModelConfigDTO, ModelConfigRow,
  AIChatRequest, AIChatResponse,
  AIEmbedRequest, AIEmbedResponse,
  AICallLogDTO, AIStatsDTO,
  IAiService,
} from './types';
export {
  AI_DEFAULT_RPM, AI_DEFAULT_TPM,
  AI_CHAT_TIMEOUT_MS, AI_EMBED_TIMEOUT_MS,
  AI_LOG_MAX_RETRIES, AI_LOG_CACHE_TTL,
  DEFAULT_EMBED_MODEL as AI_DEFAULT_EMBED_MODEL,
} from './constants';
export { AIClient } from './client';
export type { AIClientEnv } from './client';
