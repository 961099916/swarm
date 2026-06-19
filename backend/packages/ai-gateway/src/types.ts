// ─── DTO ───
export interface ModelConfigDTO {
  id: string;
  purpose: string;
  provider: string;
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

export interface AIChatRequest {
  traceId: string;
  modelConfigId?: string;
  userId?: string;
  agentId?: string;
  taskId?: string;
  messages: Array<{ role: string; content: string }>;
}

export interface AIChatResponse {
  content: string;
  modelConfigId?: string;
  provider?: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd?: number;
}

export interface AIEmbedRequest {
  traceId: string;
  modelConfigId?: string;
  userId?: string;
  kbId?: string;
  taskId?: string;
  input: string | string[];
}

export interface AIEmbedResponse {
  embeddings: number[][];
  modelConfigId?: string;
  provider?: string;
  modelName: string;
  latencyMs: number;
  costUsd?: number;
}

export interface AICallLogDTO {
  id: number;
  traceId: string;
  purpose: string;
  provider: string;
  modelName: string;
  userId?: string;
  agentId?: string;
  taskId?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: string;
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
