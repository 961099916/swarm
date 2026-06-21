// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/services/tool-runner.ts

import { ToolRegistry, ToolContext } from "../tools";
import { appendTaskLog } from "../utils";
import { WorkflowConstants } from "../constants/workflow.constant";

export class ToolRunnerService {
  constructor(private env: { DB: D1Database; AI: any; EMAIL_FROM?: string }) {}

  /**
   * 调度执行系统边缘微工具
   */
  public async runEdgeTool(toolName: string, input: any, email: string | undefined, taskId?: string): Promise<string> {
    const db = this.env.DB;
    const tool = await ToolRegistry.getOrLoad(db, toolName);
    if (!tool) {
      const available = ToolRegistry.getAvailableTools().join(", ");
      if (taskId) {
        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_ERROR as any, `[工具调度] 未找到工具: ${toolName}，可用: ${available}`);
      }
      return `[ERROR] 不支持的工具: ${toolName}。可用工具: ${available}`;
    }
    const context: ToolContext = {
      traceId: taskId || "SYSTEM_WORKFLOW",
      env: {
        DB: db,
        AI: this.env.AI,
        EMAIL_FROM: this.env.EMAIL_FROM,
        EMAIL_TO: email
      }
    };
    if (taskId) {
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[工具调度] 正在查找工具: ${toolName}`);
    }
    return await tool.execute(input, context);
  }
}
