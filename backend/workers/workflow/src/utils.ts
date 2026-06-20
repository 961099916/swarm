
import { taskLogs, tasks } from "@swarm/agent";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/utils.ts
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

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
    if (level === LogLevel.ERROR) {
      TraceLogger.error("WORKFLOW", "ENGINE_EXECUTION_LOG", taskId, message);
    } else if (level === LogLevel.WARN) {
      TraceLogger.warn("WORKFLOW", "ENGINE_EXECUTION_LOG", taskId, message);
    } else {
      TraceLogger.info("WORKFLOW", "ENGINE_EXECUTION_LOG", taskId, message);
    }
  }
}

export class D1DatabaseAppender implements LogAppender {
  private db: D1Database | null = null;
  private queue: any | null = null;

  public setDatabase(db: D1Database): void {
    this.db = db;
  }

  public setQueue(queue: any): void {
    this.queue = queue;
  }

  public async append(taskId: string, level: LogLevel, message: string): Promise<void> {
    const now = new Date().toISOString();

    // 1. 优先使用队列进行异步削峰
    if (this.queue && typeof this.queue.send === "function") {
      try {
        await this.queue.send({
          type: "TASK_LOG",
          payload: {
            taskId,
            level,
            message,
            createdAt: now
          }
        });
        return;
      } catch (queueErr: unknown) {
        TraceLogger.warn("WORKFLOW", "QUEUE_SEND_FAILED", taskId, `异步日志队列投递失败，自适应降级回源 D1: ${queueErr instanceof Error ? queueErr.message : String(queueErr)}`);
      }
    }

    // 2. 降级：D1 同步插入
    if (!this.db) {
      return;
    }
    try {
      const drizzleDb = drizzle(this.db);
      await drizzleDb.insert(taskLogs).values({
        taskId,
        level,
        message,
        createdAt: now
      });
    } catch (err: unknown) {
      TraceLogger.error("WORKFLOW", "LOG_WRITE_FAILED", taskId, `D1 日志信道同步写入失败: ${getErrorMessage(err)}`, err);
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

  public static setQueue(queue: any): void {
    this.d1Appender.setQueue(queue);
  }

  public static async log(taskId: string, level: LogLevel, message: string): Promise<void> {
    const promises = this.appenders.map((appender) =>
      appender.append(taskId, level, message).catch((err) => {
        TraceLogger.error("WORKFLOW", "LOG_APPENDER_FAILED", "SYSTEM", `Log Appender 写入失败: ${getErrorMessage(err)}`, err);
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
  message: string,
  queue?: any
): Promise<void> {
  TaskLogger.setDatabase(db);
  if (queue) {
    TaskLogger.setQueue(queue);
  }
  
  let parsedLevel = LogLevel.INFO;
  if (level === "ERROR") parsedLevel = LogLevel.ERROR;
  if (level === "WARN") parsedLevel = LogLevel.WARN;
  
  await TaskLogger.log(taskId, parsedLevel, message);
}

export async function updateTaskStatus(
  db: D1Database,
  taskId: string,
  status: string,
  summary: string | null,
  queue?: any
): Promise<void> {
  TaskLogger.setDatabase(db);
  if (queue) {
    TaskLogger.setQueue(queue);
  }
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
  } catch (err: unknown) {
    TraceLogger.error("WORKFLOW", "TASK_STATUS_UPDATE_FAILED", taskId, `更新任务状态失败: ${getErrorMessage(err)}`, err);
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

// ══════════════════════════════════════════════════
// 6. Prompt 版本管理器 (PromptVersionManager)
// ══════════════════════════════════════════════════
import { CacheService } from "@swarm/kernel";

export class PromptManager {
  /**
   * 运行时从 D1 数据库或 KV 缓存中获取最新的活跃 Prompt 模板
   */
  public static async getPrompt(db: D1Database, kv: KVNamespace, key: string): Promise<string> {
    const cacheKey = `prompt:${key}`;
    try {
      // 1. 优先读取 KV 缓存
      const cached = await CacheService.get<string>(kv, cacheKey);
      if (cached) return cached;
    } catch {
      // 缓存读取故障自动容错
    }

    // 2. 回源 D1 数据库查询最新激活版本
    try {
      const result = await db
        .prepare("SELECT content FROM prompts WHERE key = ? AND is_active = 1 ORDER BY version DESC LIMIT 1")
        .bind(key)
        .first<{ content: string }>();

      if (result?.content) {
        const content = result.content;
        // 3. 回写缓存 (TTL: 24 小时)
        await CacheService.set(kv, cacheKey, content, 86400).catch(() => {});
        return content;
      }
    } catch (err: unknown) {
      // DDL 未就绪或网络异常时，将向上抛出以触发硬编码默认降级
      TraceLogger.error("WORKFLOW", "PROMPT_DB_FAILED", "SYSTEM", `D1 读取 Prompt 失败: ${getErrorMessage(err)}`, err);
    }

    throw new Error(`系统未配置活跃的 Prompt 资源: ${key}`);
  }
}

