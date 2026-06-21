// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/consumer/src/index.ts
import { tasks, taskLogs } from "@swarm/agent";
import { users } from "@swarm/identity";
import { creditsLedger, CreditsConfig } from "@swarm/credits";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";
import { ConsumerConstants } from "./constants/consumer.constant";

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  TASK_WORKFLOW: Fetcher;
}

export interface TaskQueueMessage {
  taskId: string;
  taskType: string;
  payload: Record<string, unknown>;
  userId: string;
  traceId: string;
}

export interface WorkflowInstance {
  create(options: {
    params: {
      taskId: string;
      taskType: string;
      payload: Record<string, unknown>;
    };
  }): Promise<{ id: string }>;
}

/**
 * 启动工作流引擎
 */
async function triggerWorkflow(
  db: D1Database,
  workflow: WorkflowInstance,
  taskId: string,
  taskType: string,
  payload: Record<string, unknown>,
  traceId: string
): Promise<void> {
  const drizzleDb = drizzle(db);
  const now = new Date().toISOString();

  await drizzleDb.insert(taskLogs).values({
    taskId,
    level: "INFO",
    message: "正在启动工作流编排引擎...",
    createdAt: now,
  });

  const run = await workflow.create({ params: { taskId, taskType, payload } });

  await drizzleDb
    .update(tasks)
    .set({ workflowRunId: run.id, status: "RUNNING", updatedAt: now })
    .where(eq(tasks.id, taskId));

  await drizzleDb.insert(taskLogs).values({
    taskId,
    level: "INFO",
    message: "工作流编排引擎启动成功，任务状态变更为运行中",
    createdAt: now,
  });

  TraceLogger.info("CONSUMER", "WORKFLOW_STARTED", traceId, `工作流启动成功: taskId=${taskId}, runId=${run.id}`);
}

/**
 * 逆向补偿：工作流启动失败时退回积分并置任务失败
 */
async function handleFailureAndRefund(
  db: D1Database,
  userId: string,
  taskId: string,
  errorMsg: string,
  traceId: string
): Promise<void> {
  try {
    const drizzleDb = drizzle(db);
    const now = new Date().toISOString();
    const taskCost = await CreditsConfig.getTaskCost(db);

    await drizzleDb.transaction(async (tx) => {
      const refundRes = await tx
        .update(users)
        .set({ credits: sql`credits + ${taskCost}`, updatedAt: now })
        .where(eq(users.id, userId))
        .returning({ credits: users.credits });

      const newBalance = refundRes.length > 0 ? refundRes[0].credits : 0;

      await tx.insert(creditsLedger).values({
        userId,
        delta: taskCost,
        balance: newBalance,
        reason: "ADMIN_ADJUST",
        refId: taskId,
        createdAt: now,
      });

      await tx
        .update(tasks)
        .set({
          status: "FAILED",
          resultSummary: `工作流启动失败: ${errorMsg}（积分已原路退回）`,
          updatedAt: now,
        })
        .where(eq(tasks.id, taskId));

      await tx.insert(taskLogs).values({
        taskId,
        level: "ERROR",
        message: `工作流启动异常: ${errorMsg}，系统自动触发逆向退款补偿成功，退回 ${taskCost} 积分，剩余 ${newBalance} 积分`,
        createdAt: now,
      });
    });

    TraceLogger.info("CONSUMER", "REFUND_COMPENSATE", traceId, `工作流启动失败，退款成功: taskId=${taskId}, userId=${userId}`, userId);
  } catch (refundErr: unknown) {
    TraceLogger.error("CONSUMER", "REFUND_CRITICAL_FAILED", traceId, `退款补偿事务失败! taskId=${taskId}, error=${getErrorMessage(refundErr)}`, refundErr, userId);
  }
}

/**
 * Queue 消息处理器
 */
async function queue(
  batch: MessageBatch<TaskQueueMessage>,
  env: Env
): Promise<void> {
  for (const msg of batch.messages) {
    const { taskId, taskType, payload, userId, traceId } = msg.body;

    TraceLogger.info("CONSUMER", "QUEUE_MESSAGE_RECEIVED", traceId, `消费任务创建消息: taskId=${taskId}`, userId);

    try {
      const wf = env.TASK_WORKFLOW as unknown as WorkflowInstance;
      await triggerWorkflow(env.DB, wf, taskId, taskType, payload, traceId);
      msg.ack();
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      TraceLogger.error("CONSUMER", "WORKFLOW_TRIGGER_FAILED", traceId, `工作流触发失败: taskId=${taskId}, error=${errMsg}`, err, userId);

      await handleFailureAndRefund(env.DB, userId, taskId, errMsg, traceId);

      if (msg.attempts >= ConsumerConstants.DEFAULT_MAX_RETRIES) {
        TraceLogger.warn("CONSUMER", "MAX_RETRIES_EXCEEDED", traceId, `消息重试已达上限: taskId=${taskId}`, userId);
        msg.ack();
      } else {
        msg.retry({ delaySeconds: ConsumerConstants.RETRY_DELAY_SECONDS });
      }
    }
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }
    return new Response("Not Found", { status: 404 });
  },
  queue,
};
