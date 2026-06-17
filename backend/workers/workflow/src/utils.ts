
// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/utils.ts
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { tasks, taskLogs, TraceLogger } from "@swarm/shared";


// ══════════════════════════════════════════════════
// 1. 强类型契约与接口定义
// ══════════════════════════════════════════════════

export enum TaskStatus {
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogAppender {
  append(taskId: string, level: LogLevel, message: string): Promise<void>;
}

export interface JsonCleanFilter {
  clean(text: string): string;
}

// ══════════════════════════════════════════════════
// 2. 日志通道分发 (Appender / Strategy Pattern)
// ══════════════════════════════════════════════════

export class ConsoleAppender implements LogAppender {
  public async append(taskId: string, level: LogLevel, message: string): Promise<void> {
    let traceLoggerLevel: "INFO" | "WARN" | "ERROR" = "INFO";
    if (level === LogLevel.ERROR) traceLoggerLevel = "ERROR";
    if (level === LogLevel.WARN) traceLoggerLevel = "WARN";

    TraceLogger.write(
      traceLoggerLevel,
      "WORKFLOW",
      "ENGINE_EXECUTION_LOG",
      taskId,
      message
    );
  }
}

export class D1DatabaseAppender implements LogAppender {
  private db: D1Database | null = null;

  public setDatabase(db: D1Database): void {
    this.db = db;
  }

  public async append(taskId: string, level: LogLevel, message: string): Promise<void> {
    if (!this.db) {
      return;
    }
    const now = new Date().toISOString();
    try {
      const drizzleDb = drizzle(this.db);
      await drizzleDb.insert(taskLogs).values({
        taskId,
        level,
        message,
        createdAt: now
      });
    } catch (err: any) {
      // 容错处理：不因日志持久化失败破坏核心业务生命周期
      console.error(`[ERROR] [TaskId: ${taskId}] D1 日志信道写入失败: ${err.message || err}`);
    }
  }
}

export class TaskLogger {
  private static d1Appender = new D1DatabaseAppender();
  private static appenders: LogAppender[] = [
    new ConsoleAppender(),
    TaskLogger.d1Appender
  ];

  public static setDatabase(db: D1Database): void {
    this.d1Appender.setDatabase(db);
  }

  public static async log(taskId: string, level: LogLevel, message: string): Promise<void> {
    const promises = this.appenders.map((appender) =>
      appender.append(taskId, level, message).catch((err) => {
        console.error(`[CRITICAL] Log Appender 写入失败: ${err.message || err}`);
      })
    );
    await Promise.all(promises);
  }
}

// ══════════════════════════════════════════════════
// 3. JSON 清洗职责链 (Chain of Responsibility)
// ══════════════════════════════════════════════════

export class MarkdownCodeBlockFilter implements JsonCleanFilter {
  public clean(text: string): string {
    return text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "");
  }
}

export class OuterBraceFilter implements JsonCleanFilter {
  public clean(text: string): string {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : text;
  }
}

export class WhitespaceNormalizeFilter implements JsonCleanFilter {
  public clean(text: string): string {
    return text
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }
}

export class JsonCleanChain {
  private filters: JsonCleanFilter[] = [];

  constructor() {
    this.filters.push(new MarkdownCodeBlockFilter());
    this.filters.push(new OuterBraceFilter());
  }

  public process(text: string): string {
    let result = text.trim();
    for (const filter of this.filters) {
      result = filter.clean(result);
    }
    return result;
  }
}

// ══════════════════════════════════════════════════
// 4. 状态翻译映射与校验
// ══════════════════════════════════════════════════

const STATE_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.RUNNING]: "运行中",
  [TaskStatus.SUCCESS]: "执行成功",
  [TaskStatus.FAILED]: "执行失败",
};

function assertValidStatus(status: string): TaskStatus {
  if (Object.values(TaskStatus).includes(status as TaskStatus)) {
    return status as TaskStatus;
  }
  throw new Error(`非法的任务状态变更: ${status}`);
}

// ══════════════════════════════════════════════════
// 5. 门面模式 Facade 函数导出
// ══════════════════════════════════════════════════

export async function appendTaskLog(
  db: D1Database,
  taskId: string,
  level: "INFO" | "WARN" | "ERROR",
  message: string
): Promise<void> {
  TaskLogger.setDatabase(db);
  
  let parsedLevel = LogLevel.INFO;
  if (level === "ERROR") parsedLevel = LogLevel.ERROR;
  if (level === "WARN") parsedLevel = LogLevel.WARN;
  
  await TaskLogger.log(taskId, parsedLevel, message);
}

export async function updateTaskStatus(
  db: D1Database,
  taskId: string,
  status: string,
  summary: string | null
): Promise<void> {
  TaskLogger.setDatabase(db);
  const now = new Date().toISOString();
  
  try {
    const validatedStatus = assertValidStatus(status);
    const drizzleDb = drizzle(db);
    await drizzleDb
      .update(tasks)
      .set({
        status: validatedStatus,
        resultSummary: summary,
        updatedAt: now
      })
      .where(eq(tasks.id, taskId));
    
    const statusLabel = STATE_LABELS[validatedStatus];
    await TaskLogger.log(taskId, LogLevel.INFO, `[系统] 任务状态变更: ${statusLabel}`);
  } catch (err: any) {
    console.error(`[ERROR] [TaskId: ${taskId}] 更新任务状态失败: ${err.message || err}`);
  }
}

export function safeParseJSON(text: string): any {
  const chain = new JsonCleanChain();
  const cleaned = chain.process(text);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return trySecondaryParse(cleaned, text);
  }
}

function trySecondaryParse(cleaned: string, originalText: string): any {
  const fallbackFilter = new WhitespaceNormalizeFilter();
  const processed = fallbackFilter.clean(cleaned);
  try {
    return JSON.parse(processed);
  } catch (innerError) {
    throw new Error(`无法解析决策 JSON。原始响应: ${originalText}`);
  }
}
