
export const AI_MODELS = {
  DEFAULT: "@cf/meta/llama-3.1-8b-instruct-fp8",
  SMALL: "@cf/meta/llama-3.2-3b-instruct"
} as const;

export type AIModelType = typeof AI_MODELS[keyof typeof AI_MODELS];

// ══════════════════════════════════════════════════
// 1. 数据库实体定义 (D1 Rows)
// ══════════════════════════════════════════════════

export type UserRole = 'FREE_USER' | 'VIP' | 'ADMIN';
export type TaskType = 'AGENT_ORCHESTRATION';
export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'SLEEPING';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type CreditReason = 'TASK_COST' | 'AD_REWARD' | 'INVITE_BONUS' | 'ADMIN_ADJUST';

export interface UserRow {
  id: string;
  wx_open_id: string;
  nickname: string | null;
  avatar_url: string | null;
  role: UserRole;
  credits: number;
  token_version: number;
  is_banned: number; // 0=正常, 1=封禁
  banned_reason: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermissionRow {
  id: number;
  role: UserRole;
  resource: string;
  action: string;
}

export interface TaskRow {
  id: string;
  user_id: string;
  task_type: TaskType;
  status: TaskStatus;
  payload: string; // JSON String
  workflow_run_id: string | null;
  credits_cost: number;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskLogRow {
  id: number;
  task_id: string;
  level: LogLevel;
  message: string;
  created_at: string;
}

export interface AgentRow {
  id: string;
  user_id: string | null;
  name: string;
  avatar: string;
  role: string;
  system_prompt: string;
  model: string;
  tools: string; // JSON String 数组
  is_preset: number; // 0=自定义, 1=系统预设
  created_at: string;
  updated_at: string;
}

export interface UserInvitationRow {
  id: number;
  inviter_id: string;
  invitee_id: string;
  bonus_given: number;
  created_at: string;
}

export interface AdRewardLogRow {
  id: number;
  user_id: string;
  ad_token_hash: string;
  credits_added: number;
  created_at: string;
}

export interface CreditsLedgerRow {
  id: number;
  user_id: string;
  delta: number;
  balance: number;
  reason: CreditReason;
  ref_id: string | null;
  created_at: string;
}

export interface ToolParamDef {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
  enum?: string[];
}

export interface DynamicToolRow {
  name: string;
  description: string;
  category: string;
  endpoint: string | null;
  method: string;
  headers: string;
  bodyTemplate: string | null;
  script: string | null;
  paramsSchema: string; // JSON 字符串数组
  responseSelector: string | null;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

// ══════════════════════════════════════════════════
// 2. API 传输对象 (DTOs)
// ══════════════════════════════════════════════════

// 统一响应包体
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  traceId?: string;
}

// 登录接口
export interface LoginReq {
  code: string; // 微信小程序 code
  nickname?: string;
  avatarUrl?: string;
  inviterId?: string; // 可选的邀请人 ID
}

export interface LoginRes {
  token: string;
  user: {
    id: string;
    nickname: string | null;
    avatarUrl: string | null;
    role: UserRole;
    credits: number;
  };
}

// 绑定邀请人接口
export interface BindInviteReq {
  inviterId: string;
}

// 广告奖励接口
export interface AdRewardReq {
  adToken: string; // 前端广告播放完毕后生成的 Token (防刷校验)
}

// 创建任务接口
export interface CreateTaskReq {
  taskType: TaskType;
  payload: Record<string, any>;
}

export interface CreateTaskRes {
  taskId: string;
}

// 任务明细
export interface TaskDetailRes {
  id: string;
  taskType: TaskType;
  status: TaskStatus;
  creditsCost: number;
  payload: Record<string, any>;
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

// 任务日志流明细
export interface TaskLogsRes {
  logs: Array<{
    level: LogLevel;
    message: string;
    createdAt: string;
  }>;
}

// ══════════════════════════════════════════════════
// 3. 管理端 DTOs (Admin API)
// ══════════════════════════════════════════════════

// 系统看板数据
export interface AdminStatsRes {
  totalUsers: number;
  runningTasks: number;
  totalTasks: number;
  todayNewTasks: number;
}

// 管理端修改角色
export interface UpdateRoleReq {
  role: UserRole;
}

// 管理端调整积分
export interface AdjustCreditsReq {
  delta: number;
  reason: string;
}

// 管理端封禁请求
export interface BanUserReq {
  isBanned: boolean;
  reason?: string;
}

// ══════════════════════════════════════════════════
// 4. 测评模块 Row 类型 (Quiz Module)
// ══════════════════════════════════════════════════

export interface QuizUserRow {
  user_id: string;
  exp: number;
  level: number;
  different_count: number;
  completed_count: number;
  updated_at: string | null;
  created_at: string;
}

export interface StageProgressRow {
  user_id: string;
  stage_id: string;
  npc_id: string;
  score: number;
  total: number;
  passed: number;
  updated_at: string;
}

export interface TestHistoryRow {
  id: string;
  user_id: string;
  test_id: string;
  test_title: string;
  test_type: string;
  result_code: string;
  result_name: string;
  raw_scores: string;
  created_at: string;
}

// ══════════════════════════════════════════════════
// 5. 智能体编排相关 DTOs (Agent Orchestration API)
// ══════════════════════════════════════════════════

export interface AgentDTO {
  id: string;
  userId: string | null;
  name: string;
  avatar: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentReq {
  name: string;
  avatar: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}

export interface AgentOrchestrationPayload {
  workflowName: string;
  goal: string;
  agents: Array<{
    agentId: string;
    roleDescription?: string;
  }>;
  maxLoops?: number;
  email?: string;
}

// 智能体修改请求
export interface UpdateAgentReq {
  agentId: string;
  name: string;
  avatar: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}

// ══════════════════════════════════════════════════
// 6. RAG 知识库模块类型
// ══════════════════════════════════════════════════

export type DocumentSourceType = 'UPLOAD' | 'WEB_SCRAPE' | 'MANUAL';
export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface KnowledgeBaseRow {
  id: string;
  name: string;
  description: string | null;
  user_id: string | null;
  is_public: number;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseDTO {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  isPublic: boolean;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeBaseReq {
  name: string;
  description?: string;
  isPublic?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface DocumentRow {
  id: string;
  kb_id: string;
  title: string;
  source_type: DocumentSourceType;
  source_url: string | null;
  raw_content: string;
  chunk_count: number;
  status: DocumentStatus;
  error_message: string | null;
  file_name: string | null;
  file_size: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentDTO {
  id: string;
  kbId: string;
  title: string;
  sourceType: DocumentSourceType;
  sourceUrl?: string;
  chunkCount: number;
  status: DocumentStatus;
  errorMessage?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AddDocumentByUrlReq {
  kbId: string;
  url: string;
  title?: string;
}

export interface AddDocumentManualReq {
  kbId: string;
  title: string;
  content: string;
}

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  kb_id: string;
  chunk_index: number;
  chunk_text: string;
  vector_index_id: string | null;
  token_count: number;
  created_at: string;
}

export interface SearchKnowledgeReq {
  kbId: string;
  query: string;
  topK?: number;
  minScore?: number;
}

export interface KnowledgeChunkDTO {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  kbId: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface SearchKnowledgeRes {
  results: KnowledgeChunkDTO[];
  totalChunks: number;
}

export interface RAGContextInjectReq {
  kbIds: string[];
  query: string;
  maxChunks?: number;
  minScore?: number;
}

export interface RAGContextInjectRes {
  context: string;
  chunks: KnowledgeChunkDTO[];
}

// ══════════════════════════════════════════════════
// 7. AI Gateway 模块类型
// ══════════════════════════════════════════════════

export type ModelPurpose = 'CHAT' | 'EMBEDDING';
export type AIProvider = 'workers-ai' | 'openai' | 'anthropic' | 'azure-openai';
export type AICallStatus = 'SUCCESS' | 'FAILED' | 'RATE_LIMITED';

export interface ModelConfigRow {
  id: string;
  purpose: string;
  provider: string;
  model_name: string;
  display_name: string | null;
  is_default: number;
  is_active: number;
  rate_limit_rpm: number;
  rate_limit_tpm: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  config_json: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ModelConfigDTO {
  id: string;
  purpose: ModelPurpose;
  provider: AIProvider;
  modelName: string;
  displayName?: string;
  isDefault: boolean;
  isActive: boolean;
  rateLimitRpm: number;
  rateLimitTpm: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  config: Record<string, any>;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIChatRequest {
  modelConfigId?: string;
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  traceId: string;
  userId?: string;
  agentId?: string;
  taskId?: string;
}

export interface AIChatResponse {
  content: string;
  modelConfigId: string;
  provider: AIProvider;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
}

export interface AIEmbedRequest {
  modelConfigId?: string;
  input: string | string[];
  traceId: string;
  userId?: string;
  kbId?: string;
  taskId?: string;
}

export interface AIEmbedResponse {
  embeddings: number[][];
  modelConfigId: string;
  provider: AIProvider;
  modelName: string;
  latencyMs: number;
  costUsd: number;
}

export interface AICallLogQuery {
  startTime?: string;
  endTime?: string;
  userId?: string;
  modelName?: string;
  purpose?: ModelPurpose;
  status?: AICallStatus;
  page?: number;
  limit?: number;
}

export interface AICallLogDTO {
  id: number;
  traceId: string;
  purpose: ModelPurpose;
  provider: AIProvider;
  modelName: string;
  userId?: string;
  agentId?: string;
  taskId?: string;
  kbId?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: AICallStatus;
  errorMessage?: string;
  costUsd: number;
  createdAt: string;
}

export interface AIStatsDTO {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  rateLimitedCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  callsByModel: Array<{ modelName: string; count: number; costUsd: number }>;
  callsByHour: Array<{ hour: string; count: number }>;
}

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/packages/shared/src/types.ts
export * from "./schema";
export * from "./constants";
export * from "./logger";
export * from "./cache";
export * from "./ai-gateway";
