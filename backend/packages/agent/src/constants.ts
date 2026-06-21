// File: packages/agent/src/constants.ts
/// <reference types="@cloudflare/workers-types" />
import { ConfigService } from "@swarm/kernel";

/** AI 模型映射 */
export const AI_MODELS = {
  SMALL: "@cf/meta/llama-3.2-3b-instruct",
} as const;

/** Supervisor 决策保留最近 N 轮记忆 */
export const MEMORY_RECENT_COUNT = 6;

/** Agent 推理保留最近 N 轮上下文 */
export const MEMORY_AGENT_COUNT = 4;

/**
 * AgentConfig — 智能体与任务工作流动态配置读取门面
 */
export const AgentConfig = {
  /** 获取默认大模型路由 */
  async getDefaultModel(db: D1Database): Promise<string> {
    return ConfigService.get(db, "workflow.default_model");
  },

  /** 多智能体协作默认最大轮数 */
  async getDefaultMaxLoops(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "workflow.default_max_loops");
  }
};
