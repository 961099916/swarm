
import { WorkflowTool, ToolContext, InputField } from "./types";

export abstract class BaseWorkflowTool<TInput = any> implements WorkflowTool<TInput> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: InputField[];

  protected abstract run(input: TInput, ctx: ToolContext): Promise<string>;
  protected abstract validate(input: TInput): void;

  public async execute(input: TInput, ctx: ToolContext): Promise<string> {
    const startTime = Date.now();
    const traceId = ctx.traceId || "N/A";
    console.debug(`[${traceId}] [Tool - ${this.name}] 开始执行...`);

    try {
      this.validate(input);
      const result = await this.run(input, ctx);
      const duration = Date.now() - startTime;
      console.info(`[${traceId}] [Tool - ${this.name}] 执行成功，耗时 ${duration}ms`);
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `[${traceId}] [Tool - ${this.name}] 执行失败，耗时 ${duration}ms，错误: ${error.message || error}`
      );
      // 统一返回以 [ERROR] 开头的错误提示，不阻断工作流主控制器的 ReAct 决策链
      return `[ERROR] 工具 ${this.name} 执行失败: ${error.message || error}`;
    }
  }
}
