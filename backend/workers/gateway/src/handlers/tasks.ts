/**
 * 任务处理模块
 *
 * 职责链: 参数校验 → 积分扣减 → D1 事务写入 → Workflow 引擎触发
 *
 * @module handlers/tasks
 */

import { CreateTaskReq, CreateTaskRes, tasks, taskLogs } from "@swarm/agent";
import { creditsLedger, TASK_COST } from "@swarm/credits";
import { UserRow, users } from "@swarm/identity";
import { TraceLogger } from "@swarm/kernel";
import { ApiRes, getErrorMessage } from "/kernel";
import { RequiredFieldsValidator, TaskTypeValidator, ValidatorChain } from "../utils/validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql, and, desc } from "drizzle-orm";

function buildCreateTaskValidatorChain(): ValidatorChain<CreateTaskReq> {
  return new ValidatorChain<CreateTaskReq>()
    .add(new RequiredFieldsValidator(["taskType", "payload"]))
    .add(new TaskTypeValidator());
}

async function executeCreateTaskTransaction(
  db: D1Database,
  user: UserRow,
  taskId: string,
  taskType: string,
  payload: Record<string, any>,
  newBalance: number
): Promise<void> {
  const drizzleDb = drizzle(db);
  const now = new Date().toISOString();
  const taskTypeName = "多智能体协同";
  
  await drizzleDb.batch([
    drizzleDb
      .update(users)
      .set({ credits: sql`credits - ${TASK_COST}`, updatedAt: now })
      .where(eq(users.id, user.id)),
    drizzleDb.insert(tasks).values({
      id: taskId,
      userId: user.id,
      taskType,
      status: "PENDING",
      payload: JSON.stringify(payload),
      creditsCost: TASK_COST,
      createdAt: now,
      updatedAt: now
    }),
    drizzleDb.insert(creditsLedger).values({
      userId: user.id,
      delta: -TASK_COST,
      balance: newBalance,
      reason: "TASK_COST",
      refId: taskId,
      createdAt: now
    }),
    drizzleDb.insert(taskLogs).values({
      taskId,
      level: "INFO",
      message: `[系统] 任务已创建，类型: ${taskTypeName}，消耗 ${TASK_COST} 积分，剩余 ${newBalance} 积分`,
      createdAt: now
    })
  ]);
}

async function triggerWorkflowEngine(
  db: D1Database,
  workflow: any,
  taskId: string,
  taskType: string,
  payload: Record<string, any>
): Promise<void> {
  const drizzleDb = drizzle(db);
  const now = new Date().toISOString();
  if (workflow && typeof workflow.create === "function") {
    await drizzleDb.insert(taskLogs).values({
      taskId,
      level: "INFO",
      message: "正在启动工作流引擎...",
      createdAt: now
    });
    
    const run = await workflow.create({ params: { taskId, taskType, payload } });
    await drizzleDb
      .update(tasks)
      .set({ workflowRunId: run.id, status: "RUNNING", updatedAt: now })
      .where(eq(tasks.id, taskId));
      
    await drizzleDb.insert(taskLogs).values({
      taskId,
      level: "INFO",
      message: "工作流引擎启动成功，状态已切换为运行中",
      createdAt: now
    });
  } else {
        TraceLogger.warn("GATEWAY", "WORKFLOW_BINDING_MISSING", "SYSTEM", `未检测到绑定的 TASK_WORKFLOW 实例，工作流未触发`);
    await drizzleDb.insert(taskLogs).values({
      taskId,
      level: "WARN",
      message: "未检测到工作流引擎绑定，任务将使用兼容模式运行",
      createdAt: now
    });
  }
}

async function handleWfEngineFailure(db: D1Database, taskId: string, errorMsg: string): Promise<void> {
  const drizzleDb = drizzle(db);
  const now = new Date().toISOString();
  await drizzleDb.update(tasks).set({ status: "FAILED", updatedAt: now }).where(eq(tasks.id, taskId));
  await drizzleDb.insert(taskLogs).values({
    taskId,
    level: "ERROR",
    message: `工作流启动失败: ${errorMsg}`,
    createdAt: now
  });
}

export async function handleCreateTask(
  request: Request,
  db: D1Database,
  workflow: any,
  user: UserRow,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as CreateTaskReq;
    const validationError = buildCreateTaskValidatorChain().validate(body);
    if (validationError) return ApiRes.badRequest(validationError, traceId);

    if (user.credits < TASK_COST) {
      return ApiRes.badRequest(`账户积分不足。启动任务需要 ${TASK_COST} 点，当前仅有 ${user.credits} 点`, traceId);
    }

    const taskId = crypto.randomUUID();
    const newBalance = user.credits - TASK_COST;
    await executeCreateTaskTransaction(db, user, taskId, body.taskType, body.payload, newBalance);

    try {
      await triggerWorkflowEngine(db, workflow, taskId, body.taskType, body.payload);
    } catch (wfError: unknown) {
          TraceLogger.error("GATEWAY", "WORKFLOW_START_FAILED", traceId, `启动 CF Workflow 失败: getErrorMessage(wfError)`, wfError);
      await handleWfEngineFailure(db, taskId, wfError.message || "未知异常");
    }

    const resData: CreateTaskRes = { taskId };
    return ApiRes.success(resData, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "CREATE_TASK_FAILED", traceId, `创建任务失败: getErrorMessage(error)`, error);
    if (error.message && error.message.includes("constraint failed")) {
      const isCreditsErr = error.message.includes("credits");
      return ApiRes.badRequest(isCreditsErr ? "积分余额不足，创建任务失败" : "系统异常，请稍后重试", traceId);
    }
    return ApiRes.internalError("系统部署任务异常，请稍后再试", traceId);
  }
}

export async function handleListTasks(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "ALL";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const drizzleDb = drizzle(db);
    const conditions = [eq(tasks.userId, userId)];

    if (status !== "ALL") {
      conditions.push(eq(tasks.status, status));
    }

    const results = await drizzleDb
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);

    const parsedTasks = (results || []).map((row: any) => ({
      id: row.id,
      user_id: row.userId,
      task_type: row.taskType,
      status: row.status,
      payload: row.payload ? JSON.parse(row.payload) : {},
      workflow_run_id: row.workflowRunId,
      credits_cost: row.creditsCost,
      result_summary: row.resultSummary,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    }));

    return ApiRes.success(parsedTasks, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "LIST_TASKS_FAILED", traceId, `查询任务列表失败: getErrorMessage(error)`, error);
    return ApiRes.internalError("系统查询任务列表异常", traceId);
  }
}

export async function handleTaskLogs(
  request: Request,
  db: D1Database,
  user: UserRow,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) return ApiRes.badRequest("缺少 taskId 参数", traceId);

    const drizzleDb = drizzle(db);
    const taskResult = await drizzleDb.select({ userId: tasks.userId }).from(tasks).where(eq(tasks.id, taskId));
    if (!taskResult || taskResult.length === 0) return ApiRes.notFound("未找到该任务，查看日志失败", traceId, );
    if (taskResult[0].userId !== user.id && user.role !== "ADMIN") {
      return ApiRes.forbidden("无权查看该任务日志", traceId);
    }

    const results = await drizzleDb
      .select({ level: taskLogs.level, message: taskLogs.message, createdAt: taskLogs.createdAt })
      .from(taskLogs)
      .where(eq(taskLogs.taskId, taskId))
      .orderBy(taskLogs.createdAt);

    const logsData = {
      logs: (results || []).map((row: any) => ({
        level: row.level,
        message: row.message,
        createdAt: row.createdAt
      }))
    };
    return ApiRes.success(logsData, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "TASK_LOGS_FAILED", traceId, `查询任务日志失败: getErrorMessage(error)`, error);
    return ApiRes.internalError("系统查询日志流异常", traceId);
  }
}
