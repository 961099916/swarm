
export interface ToolContext {
  traceId: string;
  env: {
    DB?: any;
    AI?: any;
    EMAIL_FROM?: string;
    [key: string]: any;
  };
}

// ══════════════════════════════════════════════════
// 工具 Schema 定义（契约形式的入参声明）
// ══════════════════════════════════════════════════

export type ParamType = "string" | "number" | "boolean" | "object" | "array";

export interface InputField {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: InputField[];
}

// ══════════════════════════════════════════════════
// 扩展 WorkflowTool 接口，增加 inputSchema
// ══════════════════════════════════════════════════

export interface WorkflowTool<TInput = any> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: InputField[];
  execute(input: TInput, ctx: ToolContext): Promise<string>;
}
