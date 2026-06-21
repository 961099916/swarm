// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/packages/kernel/src/business-error.ts

/**
 * BaseBusinessError — 全局业务领域异常基类
 * 
 * 按照阿里巴巴开发规范，所有预期的业务规则冲突均应该使用强类型业务异常抛出，
 * 统一由 Controller/Web 层拦截并映射为错误码及状态码输出。
 */
export class BaseBusinessError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly httpStatus: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // 恢复原型链以确保 instanceof 能够正确工作
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * BusinessException — 统一业务异常，供限界上下文业务逻辑抛出
 */
export class BusinessException extends BaseBusinessError {
  constructor(code: number, message: string, httpStatus: number = 500) {
    super(code, message, httpStatus);
  }
}

interface HonoContextLike {
  get(key: string): any;
  json(body: any, status?: any): any;
}

/**
 * handleGlobalError — 统一微服务 Hono 全局 ErrorHandler 拦截器 (ExceptionInterceptor)
 */
export function handleGlobalError(err: Error, c: HonoContextLike, module: string): any {
  const traceId = c.get("traceId") || crypto.randomUUID();
  const userId = c.get("userId") || undefined;

  // 1. 判断是否是已知的强类型业务异常
  if (err instanceof BaseBusinessError) {
    // 业务预期的限制异常，记录为 WARN 级即可，避免物理报警泛滥
    const line = JSON.stringify({
      traceId,
      timestamp: new Date().toISOString(),
      level: "WARN",
      module,
      event: "BUSINESS_EXCEPTION",
      userId,
      message: err.message,
      payload: { code: err.code, httpStatus: err.httpStatus }
    });
    console.warn(line);
    
    // 统一 ApiRes 结构返回给端侧
    return c.json({
      code: err.code,
      message: err.message,
      traceId,
      timestamp: new Date().toISOString(),
    }, err.httpStatus);
  }

  // 2. 兜底物理异常或未捕获的运行时致命 Crash，记录为 ERROR 级
  const line = JSON.stringify({
    traceId,
    timestamp: new Date().toISOString(),
    level: "ERROR",
    module,
    event: "UNCAUGHT_EXCEPTION",
    userId,
    message: err.message || String(err),
    exception: { message: err.message, stack: err.stack }
  });
  console.error(line);

  return c.json({
    code: 1999, // ERROR_CODE.INTERNAL
    message: "系统繁忙，请稍后再试",
    traceId,
    timestamp: new Date().toISOString(),
  }, 500);
}

