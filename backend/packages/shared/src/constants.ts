/**
 * 业务常量定义
 *
 * 将散布在代码中的魔法值集中管理，所有 worker 共享同一份常量。
 * 修改业务规则时仅需修改此文件，避免遗漏。
 */

// ══════════════════════════════════════════════════
// 积分系统
// ══════════════════════════════════════════════════

/** 新用户注册赠送积分 */
export const INITIAL_CREDITS = 50;

/** 邀请奖励积分 */
export const INVITE_REWARD = 50;

/** 广告激励积分 */
export const AD_REWARD = 20;

/** 创建任务消耗积分 */
export const TASK_COST = 5;

// ══════════════════════════════════════════════════
// 认证与 Token
// ══════════════════════════════════════════════════

/** JWT 过期天数 */
export const TOKEN_EXPIRY_DAYS = 7;

/** JWT 过期秒数 (计算后) */
export const TOKEN_EXPIRY_SECONDS = TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

// ══════════════════════════════════════════════════
// 分页
// ══════════════════════════════════════════════════

/** 后台管理列表默认每页条数 */
export const DEFAULT_PAGE_LIMIT = 20;

/** 积分流水默认每页条数 */
export const CREDITS_LIMIT = 50;

// ══════════════════════════════════════════════════
// 工作流引擎
// ══════════════════════════════════════════════════

/** 多智能体协作默认最大轮数 */
export const DEFAULT_MAX_LOOPS = 5;

/** Supervisor 决策保留最近 N 轮记忆 */
export const MEMORY_RECENT_COUNT = 6;

/** Agent 推理保留最近 N 轮上下文 */
export const MEMORY_AGENT_COUNT = 4;

// ══════════════════════════════════════════════════
// 测评系统
// ══════════════════════════════════════════════════

/** 每级所需经验值 */
export const EXP_PER_LEVEL = 100;

/** 关卡通过阈值 (分数占比) */
export const QUIZ_PASS_THRESHOLD = 0.6;

/** 通过关卡奖励经验 */
export const EXP_STAGE_PASS = 20;

/** 完成测评奖励经验 */
export const EXP_QUIZ_COMPLETE = 10;

/** 纯测评计算奖励经验 */
export const EXP_QUIZ_CALCULATE = 5;

/** 测评历史列表最大返回条数 */
export const TEST_HISTORY_MAX_LIMIT = 200;

// ══════════════════════════════════════════════════
// RAG 知识库
// ══════════════════════════════════════════════════

/** 默认分块字符数 */
export const RAG_DEFAULT_CHUNK_SIZE = 500;

/** 默认分块重叠字符数 */
export const RAG_DEFAULT_CHUNK_OVERLAP = 100;

/** 默认检索 Top-K */
export const RAG_DEFAULT_TOP_K = 5;

/** 最低相似度阈值 */
export const RAG_DEFAULT_MIN_SCORE = 0.4;

/** 嵌入生成前缀（e5 模型要求） */
export const RAG_EMBED_PASSAGE_PREFIX = "passage: ";
export const RAG_EMBED_QUERY_PREFIX = "query: ";

/** RAG 上下文注入最大字符数 */
export const RAG_MAX_CONTEXT_LENGTH = 3000;

/** 文档最大文件大小（字节） */
export const RAG_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 嵌入并发上限 */
export const RAG_MAX_CONCURRENT_EMBEDDINGS = 10;

// ══════════════════════════════════════════════════
// AI Gateway
// ══════════════════════════════════════════════════

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
