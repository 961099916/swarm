
import { WorkflowTool, ToolDefinition } from "./types";
import { DynamicToolRow } from "@swarm/shared";
import { DynamicWorkflowTool } from "./dynamic-tool";

export class ToolRegistry {
  private static tools: Map<string, WorkflowTool> = new Map();

  public static register(tool: WorkflowTool): void {
    this.tools.set(tool.name, tool);
  }

  public static get(name: string): WorkflowTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 动态按需加载或从缓存获取工具
   */
  public static async getOrLoad(db: any, name: string): Promise<WorkflowTool | undefined> {
    const cached = this.tools.get(name);
    if (cached) return cached;

    if (!db) return undefined;

    try {
      const row = (await db
        .prepare("SELECT * FROM tools WHERE name = ? AND enabled = 1")
        .bind(name)
        .first()) as DynamicToolRow | null;

      if (!row) return undefined;

      const dynamicTool = new DynamicWorkflowTool(row);
      this.register(dynamicTool);
      console.info(`[INFO] [TraceID: DB_LOAD] 成功按需装载数据库动态工具: ${row.name}`);
      return dynamicTool;
    } catch (e: any) {
      console.error(`[ERROR] [TraceID: DB_LOAD] 动态按需装载工具 ${name} 异常: ${e.message}`);
      return undefined;
    }
  }

  /**
   * 从数据库一次性装载所有启用的动态工具
   */
  public static async loadAllFromDb(db: any): Promise<void> {
    if (!db) return;
    try {
      const { results } = (await db
        .prepare("SELECT * FROM tools WHERE enabled = 1")
        .all()) as { results: DynamicToolRow[] | null };

      if (results) {
        let loadCount = 0;
        for (const row of results) {
          if (!this.tools.has(row.name)) {
            const dynamicTool = new DynamicWorkflowTool(row);
            this.register(dynamicTool);
            loadCount++;
          }
        }
        if (loadCount > 0) {
          console.info(`[INFO] [TraceID: DB_LOAD] 从数据库成功批量装载 ${loadCount} 个动态工具`);
        }
      }
    } catch (e: any) {
      console.error(`[ERROR] [TraceID: DB_LOAD] 批量加载数据库动态工具失败: ${e.message}`);
    }
  }

  public static getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取所有已注册工具的契约定义列表。
   * 供 Supervisor System Prompt 动态生成工具描述使用。
   */
  public static getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));
  }
}

