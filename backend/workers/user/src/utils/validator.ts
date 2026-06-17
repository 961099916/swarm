// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/utils/validator.ts

export interface RequestValidator<T = any> {
  validate(data: T): string | null;
}

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
