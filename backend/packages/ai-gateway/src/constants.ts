/** 默认每分钟请求数限制（每个用户） */
export const AI_DEFAULT_RPM = 30;

/** 默认每分钟 Token 限制（每个用户） */
export const AI_DEFAULT_TPM = 100000;

/** LLM 调用超时（毫秒） */
export const AI_CHAT_TIMEOUT_MS = 30000;

/** 嵌入调用超时（毫秒） */
export const AI_EMBED_TIMEOUT_MS = 15000;

/** 日志异步写入最大重试次数 */
export const AI_LOG_MAX_RETRIES = 3;

/** AI 调用日志 KV 缓存 TTL（秒） */
export const AI_LOG_CACHE_TTL = 300;

/** Workers AI 嵌入模型（默认） */
export const DEFAULT_EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";
