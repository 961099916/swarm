
import { WorkflowTool, ToolContext, InputField } from "./types";
import { TraceLogger } from "@swarm/kernel";

export abstract class BaseWorkflowTool<TInput = unknown> implements WorkflowTool<TInput> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: InputField[];

  public async execute(input: TInput, ctx: ToolContext): Promise<string> {
    const startTime = Date.now();
    const traceId = ctx.traceId || "N/A";

    try {
      this.validate(input);
      const result = await this.run(input, ctx);
      const duration = Date.now() - startTime;
      TraceLogger.info("WORKFLOW", "TOOL_EXEC_SUCCESS", traceId, `[Tool - ${this.name}] 执行成功`, undefined, { durationMs: duration });
      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      TraceLogger.error("WORKFLOW", "TOOL_EXEC_FAILED", traceId, `[Tool - ${this.name}] 执行失败`, error, undefined, { durationMs: duration });
      // 统一返回以 [ERROR] 开头的错误提示，不阻断工作流主控制器的 ReAct 决策链
      return `[ERROR] 工具 ${this.name} 执行失败: getErrorMessage(error)`;
    }
  }
}
