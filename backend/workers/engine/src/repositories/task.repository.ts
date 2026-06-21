// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/repositories/task.repository.ts

import { tasks, taskLogs } from "@swarm/agent";
import { EngineConstants } from "../constants/engine.constant";
import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { CreditsConfig } from "@swarm/credits";

/**
 * TaskRepository — 任务持久化仓储
 * 
 * 隐藏 D1 数据库底层与 Drizzle SQL 构建细节，为业务层提供纯粹的领域 CRUD 与 Batch 事务接口。
 */
export class TaskRepository {
  constructor(private db: D1Database) {}

  /**
   * 原子创建任务与扣减积分 (Batch)
   */
  public async executeCreateTaskTransaction(
    userId: string,
    taskId: string,
    taskType: string,
    payload: Record<string, any>
  ): Promise<number> {
    const now = new Date().toISOString();
    const cost = await CreditsConfig.getTaskCost(this.db);

    // 1. 原子扣减积分 (RETURNING 在 D1 内原子执行)
    const updateRes = await this.db
      .prepare(
        "UPDATE users SET credits = credits - ?, updated_at = ? WHERE id = ? AND credits >= ? RETURNING credits"
      )
      .bind(cost, now, userId, cost)
      .all();

    if (!updateRes.results || updateRes.results.length === 0) {
      throw new Error("INSUFFICIENT_CREDITS");
    }

    const currentBalance = (updateRes.results[0] as any).credits;

    // 2. 批处理插入，保障建单强一致
    await this.db.batch([
      this.db.prepare(
        "INSERT INTO tasks (id, user_id, task_type, status, payload, credits_cost, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(taskId, userId, taskType, EngineConstants.STATUS_PENDING, JSON.stringify(payload), cost, now, now),

      this.db.prepare(
        "INSERT INTO credits_ledger (user_id, delta, balance, reason, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(userId, -cost, currentBalance, EngineConstants.REASON_TASK_COST, taskId, now),

      this.db.prepare(
        "INSERT INTO task_logs (task_id, level, message, created_at) VALUES (?, ?, ?, ?)"
      ).bind(taskId, EngineConstants.LOG_LEVEL_INFO, `[系统] 任务已创建，消耗 ${cost} 积分，剩余 ${currentBalance} 积分`, now),
    ]);

    return currentBalance;
  }

  /**
   * 逆向退款补偿 (Batch)
   */
  public async executeRefundTransaction(userId: string, taskId: string, errorMsg: string): Promise<void> {
    const now = new Date().toISOString();
    const cost = await CreditsConfig.getTaskCost(this.db);

    // 1. 先原子退款
    const refundRes = await this.db
      .prepare("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ? RETURNING credits")
      .bind(cost, now, userId)
      .all();

    const newBalance = refundRes.results && refundRes.results.length > 0
      ? (refundRes.results[0] as any).credits
      : 0;

    // 2. 批量记录日志与流水
    await this.db.batch([
      this.db.prepare(
        "INSERT INTO credits_ledger (user_id, delta, balance, reason, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(userId, cost, newBalance, EngineConstants.REASON_ADMIN_ADJUST, taskId, now),

      this.db.prepare(
        "UPDATE tasks SET status = ?, result_summary = ?, updated_at = ? WHERE id = ?"
      ).bind(EngineConstants.STATUS_FAILED, `工作流启动失败: ${errorMsg}（积分已原路退回）`, now, taskId),

      this.db.prepare(
        "INSERT INTO task_logs (task_id, level, message, created_at) VALUES (?, ?, ?, ?)"
      ).bind(taskId, EngineConstants.LOG_LEVEL_ERROR, `工作流启动异常: ${errorMsg}，系统自动触发逆向退款补偿成功，退回 ${cost} 积分，剩余 ${newBalance} 积分`, now),
    ]);
  }

  /**
   * 写入单条普通运行日志
   */
  public async insertLog(taskId: string, level: string, message: string): Promise<void> {
    const now = new Date().toISOString();
    const drizzleDb = drizzle(this.db);
    await drizzleDb.insert(taskLogs).values({
      taskId,
      level,
      message,
      createdAt: now,
    });
  }

  /**
   * 标记任务工作流已成功绑定并变更状态为运行中 (Batch)
   */
  public async markTaskRunning(taskId: string, workflowRunId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.batch([
      this.db.prepare(
        "INSERT INTO task_logs (task_id, level, message, created_at) VALUES (?, ?, ?, ?)"
      ).bind(taskId, EngineConstants.LOG_LEVEL_INFO, "工作流编排引擎启动成功，任务状态变更为运行中", now),

      this.db.prepare(
        "UPDATE tasks SET workflow_run_id = ?, status = ?, updated_at = ? WHERE id = ?"
      ).bind(workflowRunId, EngineConstants.STATUS_RUNNING, now, taskId)
    ]);
  }

  /**
   * 分页查询任务列表
   */
  public async listTasks(userId: string, status: string, limit: number, offset: number): Promise<any[]> {
    const drizzleDb = drizzle(this.db);
    const conditions = [eq(tasks.userId, userId)];
    if (status !== "ALL") {
      conditions.push(eq(tasks.status, status));
    }
    return await drizzleDb
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * 检查任务的所有权归属
   */
  public async checkOwnership(taskId: string): Promise<{ userId: string } | null> {
    const drizzleDb = drizzle(this.db);
    const taskResult = await drizzleDb
      .select({ userId: tasks.userId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    return taskResult && taskResult.length > 0 ? taskResult[0] : null;
  }

  /**
   * 获取某任务的全部运行日志
   */
  public async getTaskLogs(taskId: string): Promise<any[]> {
    const drizzleDb = drizzle(this.db);
    return await drizzleDb
      .select({ level: taskLogs.level, message: taskLogs.message, createdAt: taskLogs.createdAt })
      .from(taskLogs)
      .where(eq(taskLogs.taskId, taskId))
      .orderBy(taskLogs.createdAt);
  }
}
