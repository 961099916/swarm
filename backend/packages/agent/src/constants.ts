/** AI 模型映射 */
export const AI_MODELS = {
  DEFAULT: "@cf/meta/llama-3.1-8b-instruct-fp8",
  SMALL: "@cf/meta/llama-3.2-3b-instruct",
} as const;

/** 多智能体协作默认最大轮数 */
export const DEFAULT_MAX_LOOPS = 5;

/** Supervisor 决策保留最近 N 轮记忆 */
export const MEMORY_RECENT_COUNT = 6;

/** Agent 推理保留最近 N 轮上下文 */
export const MEMORY_AGENT_COUNT = 4;
