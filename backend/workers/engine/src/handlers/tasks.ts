// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/handlers/tasks.ts

import { 
  CreateTaskReq, 
  CreateTaskRes, 
  tasks, 
  creditsLedger, 
  taskLogs, 
  users, 
  TASK_COST,
  TraceLogger
} from "@swarm/shared";
import { getDrizzleDb } from "../utils/drizzleInstance";
import { ResponseBuilder } from "../utils/response";
import { RequiredFieldsValidator, TaskTypeValidator, ValidatorChain } from "../utils/validator";
import { eq, sql, and, desc } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";

export interface WorkflowInstance {
  create(options: {
    params: {
      taskId: string;
      taskType: string;
      payload: Record<string, unknown>;
    };
  }): Promise<{ id: string }>;
}

function buildCreateTaskValidatorChain(): ValidatorChain<CreateTaskReq> {
  return new ValidatorChain<CreateTaskReq>()
    .add(new RequiredFieldsValidator(["taskType", "payload"]))
    .add(new TaskTypeValidator());
}

/**
 * 方案一：执行本地 D1 强一致物理事务扣减积分并创建任务
 */
async function executeCreateTaskTransaction(
  db: D1Database,
  userId: string,
  taskId: string,
  taskType: string,
  payload: Record<string, any>
): Promise<number> {
  const drizzleDb = getDrizzleDb(db);
  const now = new Date().toISOString();
  const taskTypeName = "多智能体协同";

  return await drizzleDb.transaction(async (tx: DrizzleD1Database) => {
    // 1. 原子扣减积分 (users表)
    // 条件：用户的 credits 必须大于等于 TASK_COST，否则 update 不会影响任何行
    const updateRes = await tx
      .update(users)
      .set({ credits: sql`credits - ${TASK_COST}`, updatedAt: now })
      .where(and(eq(users.id, userId), sql`credits >= ${TASK_COST}`))
      .returning({ credits: users.credits });

    if (updateRes.length === 0) {
      throw new Error("INSUFFICIENT_CREDITS"); // 直接抛出异常触发 tx 自动回滚，杜绝超扣
    }

    const currentBalance = updateRes[0].credits;

    // 2. 插入任务表 (tasks表)
    await tx.insert(tasks).values({
      id: taskId,
      userId,
      taskType,
      status: "PENDING",
      payload: JSON.stringify(payload),
      creditsCost: TASK_COST,
      createdAt: now,
      updatedAt: now
    });

    // 3. 写入资产账本流水表 (credits_ledger表)
    await tx.insert(creditsLedger).values({
      userId,
      delta: -TASK_COST,
      balance: currentBalance,
      reason: "TASK_COST",
      refId: taskId,
      createdAt: now
    });

    // 4. 写入任务初始日志
    await tx.insert(taskLogs).values({
      taskId,
      level: "INFO",
      message: `[系统] 任务已创建，类型: ${taskTypeName}，消耗 ${TASK_COST} 积分，剩余 ${currentBalance} 积分`,
      createdAt: now
    });

    return currentBalance;
  });
}

/**
 * 启动工作流引擎（Cloudflare Workflows 强幂等触发）
 */
async function triggerWorkflowEngine(
  db: D1Database,
  workflow: WorkflowInstance,
  taskId: string,
  taskType: string,
  payload: Record<string, any>
): Promise<void> {
  const drizzleDb = getDrizzleDb(db);
  const now = new Date().toISOString();

  if (workflow && typeof workflow.create === "function") {
    await drizzleDb.insert(taskLogs).values({
      taskId,
      level: "INFO",
      message: "正在启动工作流编排引擎...",
      createdAt: now
    });
    
    // 异步触发 Cloudflare Workflows
    const run = await workflow.create({ params: { taskId, taskType, payload } });
    
    await drizzleDb
      .update(tasks)
      .set({ workflowRunId: run.id, status: "RUNNING", updatedAt: now })
      .where(eq(tasks.id, taskId));
      
    await drizzleDb.insert(taskLogs).values({
      taskId,
      level: "INFO",
      message: "工作流编排引擎启动成功，任务状态变更为运行中",
      createdAt: now
    });
  } else {
    TraceLogger.warn("ENGINE", "WORKFLOW_TRIGGER_FAILED", taskId, `未检测到绑定的 TASK_WORKFLOW 实例，工作流进入兼容悬挂模式`);
    await drizzleDb.insert(taskLogs).values({
      taskId,
      level: "WARN",
      message: "未检测到工作流引擎绑定，任务处于就绪等待状态",
      createdAt: now
    });
  }
}

/**
 * 逆向补偿事务：工作流启动失败时原子退款并置任务失败
 */
async function handleWfEngineFailureAndRefund(
  db: D1Database,
  userId: string,
  taskId: string,
  errorMsg: string
): Promise<void> {
  try {
    const drizzleDb = getDrizzleDb(db);
    const now = new Date().toISOString();

    // 在本地物理事务中完成退积分及修改状态
    await drizzleDb.transaction(async (tx: DrizzleD1Database) => {
      // 1. 原子增加退回的积分
      const refundRes = await tx
        .update(users)
        .set({ credits: sql`credits + ${TASK_COST}`, updatedAt: now })
        .where(eq(users.id, userId))
        .returning({ credits: users.credits });

      const newBalance = refundRes.length > 0 ? refundRes[0].credits : 0;

      // 2. 插入退款流水
      await tx.insert(creditsLedger).values({
        userId,
        delta: TASK_COST,
        balance: newBalance,
        reason: "ADMIN_ADJUST", // 标记为退款调整
        refId: taskId,
        createdAt: now
      });

      // 3. 将任务置为失败
      await tx
        .update(tasks)
        .set({ status: "FAILED", resultSummary: `工作流启动失败: ${errorMsg}（积分已原路退回）`, updatedAt: now })
        .where(eq(tasks.id, taskId));

      // 4. 写入任务日志记录错误
      await tx.insert(taskLogs).values({
        taskId,
        level: "ERROR",
        message: `工作流启动异常: ${errorMsg}，系统自动触发逆向退款补偿成功，退回 ${TASK_COST} 积分，剩余 ${newBalance} 积分`,
        createdAt: now
      });
    });

    TraceLogger.info("ENGINE", "TASK_REFUND_COMPENSATE", taskId, `由于工作流启动异常，系统成功退款补偿 ${TASK_COST} 积分给用户: userId=${userId}`, userId);
  } catch (refundErr: any) {
    TraceLogger.error("ENGINE", "TASK_REFUND_CRITICAL_FAILED", taskId, `严重系统故障：退款补偿事务失败! 异常: ${refundErr.message || refundErr}`, refundErr, userId);
  }
}

/**
 * 创建智能体协同任务 (POST /api/v1/tasks/create)
 */
export async function handleCreateTask(
  request: Request,
  db: D1Database,
  workflow: WorkflowInstance,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as CreateTaskReq;
    const validationError = buildCreateTaskValidatorChain().validate(body);
    if (validationError) return ResponseBuilder.badRequest(validationError, traceId);

    const drizzleDb = getDrizzleDb(db);

    // 1. 前置查询：快速检查快照积分（前置乐观拦截，减轻高并发直接落事务的开销）
    const userResult = await drizzleDb
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, userId));

    if (!userResult || userResult.length === 0) {
      return ResponseBuilder.error("用户不存在，创建任务失败", traceId, 404);
    }

    if (userResult[0].credits < TASK_COST) {
      return ResponseBuilder.badRequest(`账户积分不足。启动任务需要 ${TASK_COST} 点，当前仅有 ${userResult[0].credits} 点`, traceId);
    }

    const taskId = crypto.randomUUID();

    // 2. 执行强一致本地物理事务扣积分与建任务（100%防超卖）
    const newBalance = await executeCreateTaskTransaction(db, userId, taskId, body.taskType, body.payload);
    TraceLogger.info("ENGINE", "TASK_TRANSACTION_SUBMITTED", traceId, `积分扣减与任务创建物理事务成功: taskId=${taskId}, 扣除=${TASK_COST}, 余额=${newBalance}`, userId);

    // 3. 事务提交成功后，异步触发 Workflows 引擎
    try {
      await triggerWorkflowEngine(db, workflow, taskId, body.taskType, body.payload);
    } catch (wfError: any) {
      TraceLogger.error("ENGINE", "WORKFLOW_LAUNCH_FAILED", traceId, `启动工作流引擎异常，触发自动退款补偿机制: ${wfError.message || wfError}`, wfError, userId);
      // 逆向补偿事务：回滚积分，修改本地 Task 状态为 FAILED，保证最终数据一致性
      await handleWfEngineFailureAndRefund(db, userId, taskId, wfError.message || "未知异常");
    }

    const resData: CreateTaskRes = { taskId };
    return ResponseBuilder.success(resData, traceId);
  } catch (error: any) {
    TraceLogger.error("ENGINE", "CREATE_TASK_FAILED", traceId, `创建任务失败: ${error.message || error}`, error, userId);
    
    if (error.message === "INSUFFICIENT_CREDITS" || (error.message && error.message.includes("constraint failed"))) {
      return ResponseBuilder.badRequest("积分余额不足，创建任务失败", traceId);
    }
    return ResponseBuilder.internalError("系统部署任务异常，请稍后再试", traceId);
  }
}

/**
 * 获取任务列表 (GET /api/v1/tasks/list)
 */
export async function handleListTasks(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "ALL";
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));

    const drizzleDb = getDrizzleDb(db);
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

    return ResponseBuilder.success(parsedTasks, traceId);
  } catch (error: any) {
    TraceLogger.error("ENGINE", "LIST_TASKS_FAILED", traceId, `查询任务列表失败: ${error.message || error}`, error, userId);
    return ResponseBuilder.internalError("系统查询任务列表异常", traceId);
  }
}

/**
 * 查询任务执行日志 (GET /api/v1/tasks/logs)
 */
export async function handleTaskLogs(
  request: Request,
  db: D1Database,
  userId: string,
  userRole: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) return ResponseBuilder.badRequest("缺少 taskId 参数", traceId);

    const drizzleDb = getDrizzleDb(db);
    
    // 权限校验：只允许本人或管理员查询
    const taskResult = await drizzleDb.select({ userId: tasks.userId }).from(tasks).where(eq(tasks.id, taskId));
    if (!taskResult || taskResult.length === 0) {
      return ResponseBuilder.error("未找到该任务记录", traceId, 404);
    }
    
    if (taskResult[0].userId !== userId && userRole !== "ADMIN") {
      TraceLogger.warn("ENGINE", "UNAUTHORIZED_LOG_READ", traceId, `越权查日志拦截: 用户 ${userId} 企图访问任务 ${taskId} 的日志`, userId);
      return ResponseBuilder.forbidden("无权查看该任务的日志流", traceId);
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
    return ResponseBuilder.success(logsData, traceId);
  } catch (error: any) {
    TraceLogger.error("ENGINE", "GET_TASK_LOGS_FAILED", traceId, `查询任务日志失败: ${error.message || error}`, error, userId);
    return ResponseBuilder.internalError("系统查询日志流异常", traceId);
  }
}
