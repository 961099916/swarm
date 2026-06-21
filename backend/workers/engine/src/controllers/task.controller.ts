// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/controllers/task.controller.ts

import { CreateTaskReq, CreateTaskRes } from "@swarm/agent";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";
import { TaskRepository } from "../repositories/task.repository";
import { TaskService, WorkflowInstance } from "../services/task.service";
import { ResponseBuilder } from "../utils/response";
import { RequiredFieldsValidator, TaskTypeValidator, ValidatorChain } from "../utils/validator";
import { drizzle } from "drizzle-orm/d1";
import { users } from "@swarm/identity";
import { eq } from "drizzle-orm";
import { CreditsConfig } from "@swarm/credits";

function buildCreateTaskValidatorChain(): ValidatorChain<CreateTaskReq> {
  return new ValidatorChain<CreateTaskReq>()
    .add(new RequiredFieldsValidator(["taskType", "payload"]))
    .add(new TaskTypeValidator());
}

/**
 * TaskController — 任务控制器
 * 
 * 按照阿里规范，负责 HTTP 请求解包、第一层业务准入（积分乐观快照拦截）以及服务调用。
 */
export class TaskController {
  constructor(private taskRepo: TaskRepository, private taskSvc: TaskService) {}

  /**
   * 创建协同任务 (POST /api/v1/tasks/create)
   */
  public async handleCreateTask(
    request: Request,
    db: D1Database,
    workflow: WorkflowInstance,
    taskQueue: Queue,
    userId: string,
    traceId: string
  ): Promise<Response> {
    try {
      const body = (await request.json()) as CreateTaskReq;
      const validationError = buildCreateTaskValidatorChain().validate(body);
      if (validationError) return ResponseBuilder.badRequest(validationError, traceId);

      // 1. 前置查询：快速检查快照积分（前置乐观拦截，减轻高并发直接落事务的开销）
      const drizzleDb = drizzle(db);
      const userResult = await drizzleDb
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));

      if (!userResult || userResult.length === 0) {
        return ResponseBuilder.error("用户不存在，创建任务失败", traceId, 404);
      }

      const taskCost = await CreditsConfig.getTaskCost(db);
      if (userResult[0].credits < taskCost) {
        return ResponseBuilder.badRequest(`账户积分不足。启动任务需要 ${taskCost} 点，当前仅有 ${userResult[0].credits} 点`, traceId);
      }

      // 2. 调用业务 Service 执行核心编排流程
      const taskId = await this.taskSvc.createTask({
        userId,
        taskType: body.taskType,
        payload: body.payload,
        taskQueue,
        workflow,
        traceId
      });

      const resData: CreateTaskRes = { taskId };
      return ResponseBuilder.success(resData, traceId);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      TraceLogger.error("ENGINE", "CREATE_TASK_FAILED", traceId, `创建任务失败: ${errMsg}`, error, userId);
      
      if (errMsg === "INSUFFICIENT_CREDITS" || errMsg.includes("constraint failed")) {
        return ResponseBuilder.badRequest("积分余额不足，创建任务失败", traceId);
      }
      return ResponseBuilder.internalError("系统部署任务异常，请稍后再试", traceId);
    }
  }

  /**
   * 获取任务列表 (GET /api/v1/tasks/list)
   */
  public async handleListTasks(
    request: Request,
    userId: string,
    traceId: string
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || "ALL";
      const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
      const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));

      // 委托仓储层进行查询
      const results = await this.taskRepo.listTasks(userId, status, limit, offset);

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
    } catch (error: unknown) {
      TraceLogger.error("ENGINE", "LIST_TASKS_FAILED", traceId, `查询任务列表失败: ${getErrorMessage(error)}`, error, userId);
      return ResponseBuilder.internalError("系统查询任务列表异常", traceId);
    }
  }

  /**
   * 查询任务执行日志 (GET /api/v1/tasks/logs)
   */
  public async handleTaskLogs(
    request: Request,
    userId: string,
    userRole: string,
    traceId: string
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return ResponseBuilder.badRequest("缺少 taskId 参数", traceId);

      // 权限校验：先查 ownership
      const taskRecord = await this.taskRepo.checkOwnership(taskId);
      if (!taskRecord) {
        return ResponseBuilder.error("未找到该任务记录", traceId, 404);
      }
      
      if (taskRecord.userId !== userId && userRole !== "ADMIN") {
        TraceLogger.warn("ENGINE", "UNAUTHORIZED_LOG_READ", traceId, `越权查日志拦截: 用户 ${userId} 企图访问任务 ${taskId} 的日志`, userId);
        return ResponseBuilder.forbidden("无权查看该任务的日志流", traceId);
      }

      // 委托仓储层查询
      const results = await this.taskRepo.getTaskLogs(taskId);

      const logsData = {
        logs: (results || []).map((row: any) => ({
          level: row.level,
          message: row.message,
          createdAt: row.createdAt
        }))
      };
      return ResponseBuilder.success(logsData, traceId);
    } catch (error: unknown) {
      TraceLogger.error("ENGINE", "GET_TASK_LOGS_FAILED", traceId, `查询任务日志失败: ${getErrorMessage(error)}`, error, userId);
      return ResponseBuilder.internalError("系统查询日志流异常", traceId);
    }
  }
}
