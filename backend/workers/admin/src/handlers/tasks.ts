
import { tasks, users, taskLogs } from "@swarm/shared";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import { jsonSuccess, jsonError } from "./responseHelper";
import { appendAuditLog } from "./audit";

export async function handleAdminTasks(
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId") || "";
    const status = url.searchParams.get("status") || "ALL";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const drizzleDb = drizzle(db);
    const conditions = buildTaskConditions(targetUserId, status);
    const results = await drizzleDb
      .select({
        id: tasks.id,
        userId: tasks.userId,
        taskType: tasks.taskType,
        status: tasks.status,
        payload: tasks.payload,
        workflowRunId: tasks.workflowRunId,
        creditsCost: tasks.creditsCost,
        resultSummary: tasks.resultSummary,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        userNickname: users.nickname
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);

    const parsedTasks = results.map((row) => ({
      ...row,
      payload: row.payload ? JSON.parse(row.payload) : {}
    }));

    return jsonSuccess(parsedTasks, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 获取任务列表失败: ${error.message}`);
    return jsonError("系统查询全局任务异常", 500, traceId);
  }
}

function buildTaskConditions(userId: string, status: string): any[] {
  const conditions: any[] = [];
  if (userId) {
    conditions.push(eq(tasks.userId, userId));
  }
  if (status !== "ALL") {
    conditions.push(eq(tasks.status, status));
  }
  return conditions;
}

export async function handleCancelTask(
  adminId: string,
  taskId: string,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const drizzleDb = drizzle(db);
    const now = new Date().toISOString();
    
    await drizzleDb.batch([
      drizzleDb
        .update(tasks)
        .set({ status: "CANCELLED", updatedAt: now })
        .where(
          and(
            eq(tasks.id, taskId),
            sql`status IN ('PENDING', 'RUNNING', 'SLEEPING')`
          )
        ),
      drizzleDb.insert(taskLogs).values({
        taskId,
        level: "WARN",
        message: "任务已被系统管理员强制取消。",
        createdAt: now
      })
    ]);

    await appendAuditLog(db, adminId, "CANCEL_TASK", taskId, null);
    return jsonSuccess(null, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 取消任务失败: ${error.message}`);
    return jsonError("系统执行取消任务异常", 500, traceId);
  }
}
