// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/workflow.ts

import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";
import { taskLogs, tasks } from "@swarm/agent";
import { aiCallLogs } from "@swarm/ai-gateway";
import { TraceLogger } from "@swarm/kernel";
import { Env } from "./orchestrator";

// 重新导出状态机核心，供 Cloudflare Workflows 引擎宿主识别拉起
export { TaskOrchestrator } from "./orchestrator";

export default {
  /**
   * HTTP 路由接口 (仅充当健康检查防腐层契约)
   */
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "workflow", timestamp: new Date().toISOString() });
    }
    return new Response("Workflow Engine Active", { status: 200 });
  },

  /**
   * 统一日志与 AI 审计队列消费者
   * 采用合并攒批 + 容错退避机制，有效解决高并发下 SQLITE_BUSY 锁冲突
   */
  async queue(batch: { messages: Array<{ body: any }> }, env: Env, ctx: any): Promise<void> {
    const db = drizzle(env.DB);
    const taskLogEntries: any[] = [];
    const aiCallLogEntries: any[] = [];

    for (const msg of batch.messages) {
      const data = msg.body;
      if (!data) continue;

      if (data.type === "TASK_LOG") {
        const payload = data.payload;
        taskLogEntries.push({
          taskId: payload.taskId,
          level: payload.level,
          message: payload.message,
          createdAt: payload.createdAt
        });
      } else if (data.type === "AI_CALL_LOG") {
        const payload = data.payload;
        aiCallLogEntries.push({
          traceId: payload.traceId,
          purpose: payload.purpose,
          provider: payload.provider,
          modelName: payload.modelName,
          userId: payload.userId || null,
          agentId: payload.agentId || null,
          taskId: payload.taskId || null,
          kbId: payload.kbId || null,
          inputTokens: payload.inputTokens || 0,
          outputTokens: payload.outputTokens || 0,
          latencyMs: payload.latencyMs || 0,
          status: payload.status || "SUCCESS",
          errorMessage: payload.errorMessage || null,
          costUsd: payload.costUsd || 0,
          createdAt: payload.createdAt
        });
      }
    }

    // 1. 批量落库任务日志
    if (taskLogEntries.length > 0) {
      try {
        await db.insert(taskLogs).values(taskLogEntries);
      } catch (err: unknown) {
        TraceLogger.error("WORKFLOW", "QUEUE_BATCH_TASK_LOG_FAILED", "SYSTEM", `批量插入 Task Log 失败: ${err instanceof Error ? err.message : String(err)}，自适应退避逐条插入`, err);
        // 自适应退避逐条插入，防止单条脏数据导致整批失败丢包
        for (const entry of taskLogEntries) {
          try {
            await db.insert(taskLogs).values(entry);
          } catch (singleErr: unknown) {
            TraceLogger.error("WORKFLOW", "QUEUE_SINGLE_TASK_LOG_FAILED", entry.taskId, `单条 Task Log 插入失败: ${singleErr instanceof Error ? singleErr.message : String(singleErr)}`, singleErr);
          }
        }
      }
    }

    // 2. 批量落库 AI 调用审计日志，并累加更新任务成本
    if (aiCallLogEntries.length > 0) {
      try {
        await db.insert(aiCallLogs).values(aiCallLogEntries);

        // 批量落库成功后，对这批有 taskId 且费率大于 0 的 AI 日志进行增量成本更新
        for (const entry of aiCallLogEntries) {
          if (entry.taskId && entry.costUsd > 0) {
            try {
              await db
                .update(tasks)
                .set({
                  costUsd: sql`cost_usd + ${entry.costUsd}`,
                  updatedAt: entry.createdAt
                })
                .where(eq(tasks.id, entry.taskId));
            } catch (updateErr: unknown) {
              TraceLogger.warn("WORKFLOW", "QUEUE_UPDATE_COST_FAILED", entry.taskId, `更新任务 AI 成本失败: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`);
            }
          }
        }
      } catch (err: unknown) {
        TraceLogger.error("WORKFLOW", "QUEUE_BATCH_AI_LOG_FAILED", "SYSTEM", `批量插入 AI Log 失败: ${err instanceof Error ? err.message : String(err)}，自适应退避逐条插入`, err);
        // 自适应退避逐条插入
        for (const entry of aiCallLogEntries) {
          try {
            await db.insert(aiCallLogs).values(entry);
            // 逐条插入成功后也进行成本累加
            if (entry.taskId && entry.costUsd > 0) {
              await db
                .update(tasks)
                .set({
                  costUsd: sql`cost_usd + ${entry.costUsd}`,
                  updatedAt: entry.createdAt
                })
                .where(eq(tasks.id, entry.taskId));
            }
          } catch (singleErr: unknown) {
            TraceLogger.error("WORKFLOW", "QUEUE_SINGLE_AI_LOG_FAILED", entry.traceId, `单条 AI Log 写入/成本累加失败: ${singleErr instanceof Error ? singleErr.message : String(singleErr)}`, singleErr);
          }
        }
      }
    }
  }
};
