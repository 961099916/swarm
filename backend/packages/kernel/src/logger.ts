/**
 * TraceLogger — 全链路结构化日志
 *
 * 跨所有 Worker 共享的唯一日志组件。
 * DDD Shared Kernel：纯基础设施，不含任何业务逻辑。
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogPayload {
  traceId: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  event: string;
  userId?: string;
  message: string;
  payload?: Record<string, unknown>;
  exception?: { message: string; stack?: string };
}

/** 敏感字段正则 — 自动脱敏 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /wx_open_id/i,
  /session_key/i,
  /openid/i,
  /wx_code/i,
];

function sanitize(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function buildPayload(
  level: LogLevel,
  module: string,
  event: string,
  traceId: string,
  message: string,
  userId?: string,
  payload?: Record<string, unknown>,
  exception?: unknown
): LogPayload {
  return {
    traceId,
    timestamp: new Date().toISOString(),
    level,
    module,
    event,
    userId,
    message,
    payload: payload ? (sanitize(payload) as Record<string, unknown>) : undefined,
    exception: exception
      ? { message: (exception as Error).message || String(exception), stack: (exception as Error).stack }
      : undefined,
  };
}

function write(p: LogPayload): void {
  const line = JSON.stringify(p);
  switch (p.level) {
    case 'ERROR': console.error(line); break;
    case 'WARN':  console.warn(line);  break;
    default:      console.log(line);   break;
  }
}

export const TraceLogger = {
  debug(module: string, event: string, traceId: string, message: string, userId?: string, payload?: Record<string, unknown>) {
    write(buildPayload('DEBUG', module, event, traceId, message, userId, payload));
  },
  info(module: string, event: string, traceId: string, message: string, userId?: string, payload?: Record<string, unknown>) {
    write(buildPayload('INFO', module, event, traceId, message, userId, payload));
  },
  warn(module: string, event: string, traceId: string, message: string, userId?: string, payload?: Record<string, unknown>) {
    write(buildPayload('WARN', module, event, traceId, message, userId, payload));
  },
  error(module: string, event: string, traceId: string, message: string, exception?: unknown, userId?: string, payload?: Record<string, unknown>) {
    write(buildPayload('ERROR', module, event, traceId, message, userId, payload, exception));
  },
};
