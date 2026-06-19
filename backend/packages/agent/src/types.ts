// ─── 枚举/字面量类型 ───
export type TaskType = 'AGENT_ORCHESTRATION';
export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'SLEEPING';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// ─── 数据库行类型 ───
export interface AgentRow {
  id: string;
  user_id: string | null;
  name: string;
  avatar: string;
  role: string;
  system_prompt: string;
  model: string;
  tools: string; // JSON string array
  is_preset: number;
  model_config_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  user_id: string;
  task_type: TaskType;
  status: TaskStatus;
  payload: string;
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

export interface ToolParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean';
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
  paramsSchema: string;
  responseSelector: string | null;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

// ─── API DTO ───
export interface AgentDTO {
  id: string;
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
  avatar?: string;
  role: string;
  systemPrompt: string;
  model?: string;
  tools?: string[];
}

export interface UpdateAgentReq {
  id: string;
  name?: string;
  avatar?: string;
  role?: string;
  systemPrompt?: string;
  model?: string;
  tools?: string[];
}

export interface CreateTaskReq {
  taskType: TaskType;
  payload: Record<string, any>;
}

export interface CreateTaskRes {
  taskId: string;
}

export interface AdminStatsRes {
  totalUsers: number;
  totalTasks: number;
  totalAgents: number;
  totalCreditsIssued: number;
  recentTaskCount: number;
  failedTaskCount: number;
}
