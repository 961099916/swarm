import { AI_MODELS } from "@swarm/agent";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/utils/validator.ts

export interface RequestValidator<T = any> {
  validate(data: T): string | null;
}

export const ALLOWED_TOOLS = ["web_fetch", "email_notify", "weather_query"] as const;

export class RequiredFieldsValidator implements RequestValidator<Record<string, any>> {
  private fields: string[];

  constructor(fields: string[]) {
    this.fields = fields;
  }

  public validate(data: Record<string, any>): string | null {
    for (const field of this.fields) {
      const val = data[field];
      if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
        return `参数验证失败: ${field} 不能为空`;
      }
    }
    return null;
  }
}

export class ModelWhitelistValidator implements RequestValidator<Record<string, any>> {
  public validate(data: Record<string, any>): string | null {
    if (data.model) {
      const validModels = Object.values(AI_MODELS) as string[];
      if (!validModels.includes(data.model)) {
        return `不支持的 AI 模型: ${data.model}`;
      }
    }
    return null;
  }
}

export class ToolsSecurityValidator implements RequestValidator<Record<string, any>> {
  public validate(data: Record<string, any>): string | null {
    if (data.tools) {
      if (!Array.isArray(data.tools)) {
        return "工具链必须为数组格式";
      }
      for (const tool of data.tools) {
        const allowed: readonly string[] = ALLOWED_TOOLS;
        if (!allowed.includes(tool)) {
          return `安全策略拦截：不支持的工具 ${tool}`;
        }
      }
    }
    return null;
  }
}

export class TaskTypeValidator implements RequestValidator<Record<string, any>> {
  public validate(data: Record<string, any>): string | null {
    const validTypes = ["AGENT_ORCHESTRATION", "WORKFLOW_EXECUTION"];
    if (!data.taskType || !validTypes.includes(data.taskType)) {
      return "暂不支持该任务类型";
    }
    return null;
  }
}

export class ValidatorChain<T = any> {
  private validators: RequestValidator<T>[] = [];

  public add(validator: RequestValidator<T>): this {
    this.validators.push(validator);
    return this;
  }

  public validate(data: T): string | null {
    for (const validator of this.validators) {
      const err = validator.validate(data);
      if (err) return err;
    }
    return null;
  }
}
