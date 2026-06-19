// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/packages/shared/src/logger.ts

export interface LogPayload {
  traceId: string;
  timestamp: string;      // ISO-8601 格式
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  module: "GATEWAY" | "USER" | "ENGINE" | "WORKFLOW" | "QUIZ" | "ADMIN" | "RAG" | "AI_GATEWAY";
  event: string;           // 事件类型
  userId?: string;
  message: string;
  payload?: any;           // 格式化后的入参，必须经过数据脱敏
  aiTelemetry?: {          // 针对 AI 推理的特定遥测指标
    model: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
  };
  exception?: {            // 针对 ERROR 级别的异常详情
    message: string;
    stack?: string;
  };
}

export class TraceLogger {
  private static sanitize(payload: any): any {
    if (!payload || typeof payload !== "object") return payload;
    
    // 支持数组和对象的深拷贝脱敏
    const sanitized = Array.isArray(payload) ? [...payload] : { ...payload };
    const sensitiveKeys = ["password", "token", "jwt", "secret", "key", "adtoken", "authorization", "appsecret", "api_key", "apikey", "code", "openid", "wx_open_id", "wxopenid", "wx_app_secret"];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = "******";
      } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }
    return sanitized;
  }

  public static write(
    level: LogPayload["level"],
    module: LogPayload["module"],
    event: string,
    traceId: string,
    message: string,
    userId?: string,
    payload?: any,
    error?: Error,
    aiTelemetry?: LogPayload["aiTelemetry"]
  ) {
    const logObj: LogPayload = {
      traceId: traceId || "SYSTEM_BACKGROUND",
      timestamp: new Date().toISOString(),
      level,
      module,
      event,
      userId,
      message,
      payload: this.sanitize(payload)
    };

    if (error) {
      logObj.exception = {
        message: error.message || String(error),
        stack: error.stack
      };
    }
    if (aiTelemetry) {
      logObj.aiTelemetry = aiTelemetry;
    }

    const jsonStr = JSON.stringify(logObj);
    if (level === "ERROR") {
      console.error(jsonStr);
    } else if (level === "WARN") {
      console.warn(jsonStr);
    } else if (level === "DEBUG") {
      console.debug(jsonStr);
    } else {
      console.info(jsonStr);
    }
  }

  public static info(
    module: LogPayload["module"],
    event: string,
    traceId: string,
    message: string,
    userId?: string,
    payload?: any
  ) {
    this.write("INFO", module, event, traceId, message, userId, payload);
  }

  public static warn(
    module: LogPayload["module"],
    event: string,
    traceId: string,
    message: string,
    userId?: string,
    payload?: any
  ) {
    this.write("WARN", module, event, traceId, message, userId, payload);
  }

  public static error(
    module: LogPayload["module"],
    event: string,
    traceId: string,
    message: string,
    error?: Error,
    userId?: string,
    payload?: any
  ) {
    this.write("ERROR", module, event, traceId, message, userId, payload, error);
  }

  public static debug(
    module: LogPayload["module"],
    event: string,
    traceId: string,
    message: string,
    userId?: string,
    payload?: any
  ) {
    this.write("DEBUG", module, event, traceId, message, userId, payload);
  }
}

export async function startupSecurityCheck(
  env: any,
  traceId: string,
  requiredSecrets: string[],
  moduleName: LogPayload["module"] = "GATEWAY"
): Promise<Response | null> {
  for (const secretName of requiredSecrets) {
    if (!env[secretName] || typeof env[secretName] !== "string" || env[secretName].trim().length === 0) {
      TraceLogger.write(
        "ERROR",
        moduleName,
        "SECURITY_INIT_FAILED",
        traceId,
        `[CRITICAL] 安全检测失败: 缺少必需的机密环境变量 ${secretName}，拒绝提供服务！`
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "系统安全初始化故障，请检查环境变量部署",
          traceId
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }
  return null;
}
