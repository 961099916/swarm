// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/services/agent-runner.ts

import { AgentRow } from "@swarm/agent";
import { getErrorMessage } from "@swarm/kernel";
import { callLlmChatAndLog, truncateContent } from "./ai";
import { appendTaskLog, PromptManager } from "../utils";
import { WorkflowConstants } from "../constants/workflow.constant";

export class AgentRunnerService {
  constructor(private env: { DB: D1Database; AI: any; CACHE_KV?: any; LOG_QUEUE?: any }) {}

  /**
   * 运行子智能体进行业务推理
   */
  public async runWorkerAgent(
    taskId: string,
    agent: AgentRow,
    input: string,
    memory: Array<{ role: string; content: string }>
  ): Promise<string> {
    const db = this.env.DB;
    if (!this.env.AI) {
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_WARN as any, `[${agent.name}] AI 模型未绑定，跳过执行`);
      return `[跳过] 智能体 ${agent.name} 运行环境未绑定 AI，本轮跳过。`;
    }

    const model = agent.model || WorkflowConstants.DEFAULT_MODEL;
    await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[${agent.name}] 开始执行，使用模型: ${model}`);
    
    const memoryLimit = WorkflowConstants.MEMORY_AGENT_COUNT;
    await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[${agent.name}] 上下文包含 ${Math.min(memory.length, memoryLimit)} 条历史记忆`);

    // 对传入记忆中的文本进行截断保护，防止大模型 Context Window 被超长返回撑爆
    const safeMemory = memory.slice(-4).map(m => ({
      role: m.role,
      content: truncateContent(m.content)
    }));

    // 统一 Prompt 版本控制：优先读取 prompts 表及 KV 缓存中的最新激活版本
    let systemPrompt = agent.system_prompt;
    const promptKey = `agent:${agent.id}:system_prompt`;
    try {
      systemPrompt = await PromptManager.getPrompt(db, this.env.CACHE_KV, promptKey);
    } catch {
      // 容错降级回退
      systemPrompt = agent.system_prompt;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...safeMemory,
      { role: "user", content: input }
    ];

    try {
      const result = await callLlmChatAndLog(
        this.env.AI,
        db,
        taskId,
        agent.name,
        messages,
        agent.model,
        undefined,
        agent.id,
        this.env.LOG_QUEUE
      );
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[${agent.name}] 推理完成，输出长度 ${result.length} 字符`);
      return result;
    } catch (e: unknown) {
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_ERROR as any, `[${agent.name}] 推理失败: ${getErrorMessage(e)}`);
      return `[ERROR] 智能体 ${agent.name} 推理过程抛出异常: ${getErrorMessage(e)}`;
    }
  }
}
