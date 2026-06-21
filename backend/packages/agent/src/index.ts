// File: packages/agent/src/index.ts
/**
 * @swarm/agent — 智能体与任务编排限界上下文
 *
 * Bounded Context (DDD): 智能体定义、任务调度、工作流编排、工具注册
 * Aggregate Roots: Agent (智能体聚合), Task (任务聚合)
 */

export { agents, tasks, taskLogs, tools, adminAuditLogs } from './infrastructure/db/schema';
export type {
  AgentRow, TaskRow, TaskLogRow, DynamicToolRow, ToolParamDef,
  TaskType, TaskStatus, LogLevel,
  AgentDTO, CreateAgentReq, UpdateAgentReq,
  CreateTaskReq, CreateTaskRes, AdminStatsRes,
} from './types';
export {
  AI_MODELS, MEMORY_RECENT_COUNT, MEMORY_AGENT_COUNT,
  AgentConfig,
} from './constants';
