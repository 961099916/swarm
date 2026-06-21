/**
 * @swarm/types
 * 共享前后端及微服务间 API 交互数据契约 (DTO)
 */

export interface UserDTO {
  id: string;
  nickname: string;
  avatar: string;
  credits: number;
  createdAt: string;
}

export interface AgentDTO {
  id: string;
  name: string;
  role: string;
  avatar: string;
  prompt: string;
  isPreset: boolean;
}

export interface TaskDTO {
  id: string;
  taskType: string;
  status: string;
  payload: Record<string, any>;
  resultSummary?: string;
  creditsCost: number;
  userId: string;
  createdAt: string;
}

export interface TaskCreateRequest {
  taskType: 'AGENT_ORCHESTRATION' | 'WORKFLOW_EXECUTION';
  payload: {
    email?: string;
    workflowName: string;
    goal: string;
    agents?: Array<{ agentId: string }>;
    maxLoops?: number;
    firstStepId?: string;
    steps?: Record<string, any>;
  };
}

export interface TaskCreateResponse {
  success: boolean;
  data?: {
    taskId: string;
  };
  error?: string;
}
