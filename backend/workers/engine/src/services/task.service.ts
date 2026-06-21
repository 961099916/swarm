// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/services/task.service.ts

import { TaskRepository } from "../repositories/task.repository";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";
import { EngineConstants } from "../constants/engine.constant";

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
 * TaskService — 任务业务逻辑处理服务
 * 
 * 按照阿里开发规范，负责处理核心的创建编排、退费 Saga 补偿流及队列削峰降级流。
 */
export class TaskService {
  constructor(private taskRepo: TaskRepository) {}

  /**
   * 业务核心编排：原子划扣与建单 -> 消息队列发送 -> 异步/降级触发 Workflows -> 退费 Saga 补偿
   */
  public async createTask(params: {
    userId: string;
    taskType: string;
    payload: Record<string, any>;
    taskQueue: Queue;
    workflow: WorkflowInstance;
    traceId: string;
  }): Promise<string> {
    const { userId, taskType, payload, taskQueue, workflow, traceId } = params;
    const taskId = crypto.randomUUID();

    // 1. D1 强一致本地批处理事务扣积分并建单
    const newBalance = await this.taskRepo.executeCreateTaskTransaction(userId, taskId, taskType, payload);
    TraceLogger.info("ENGINE", "TASK_TRANSACTION_SUBMITTED", traceId, `积分扣减与任务创建物理事务成功: taskId=${taskId}, 余额=${newBalance}`, userId);

    // 2. 写入状态变更初始日志
    await this.taskRepo.insertLog(taskId, EngineConstants.LOG_LEVEL_INFO, "任务已进入异步编排队列，等待工作流引擎调度...");

    // 3. 投递异步队列以进行削峰
    try {
      await taskQueue.send({
        taskId,
        taskType: taskType,
        payload: payload,
        userId,
        traceId,
      });
      TraceLogger.info("ENGINE", "TASK_ENQUEUED", traceId, `任务消息已入队: taskId=${taskId}`, userId);
    } catch (qErr: unknown) {
      const qErrMsg = qErr instanceof Error ? qErr.message : String(qErr);
      TraceLogger.warn("ENGINE", "QUEUE_SEND_FAILED", traceId, `队列发送失败，自适应降级为同步启动流程: ${qErrMsg}`, userId);
      
      // 降级：同步唤起并做退款补偿
      try {
        await this.triggerWorkflowSync(workflow, taskId, taskType, payload, traceId);
      } catch (wfErr: unknown) {
        const wfErrMsg = wfErr instanceof Error ? wfErr.message : String(wfErr);
        await this.handleRefundCompensate(userId, taskId, wfErrMsg, traceId);
        throw new Error(`启动任务失败，系统已执行逆向退款补偿: ${wfErrMsg}`);
      }
    }

    return taskId;
  }

  /**
   * 同步触发 Workflow 引擎
   */
  private async triggerWorkflowSync(
    workflow: WorkflowInstance,
    taskId: string,
    taskType: string,
    payload: Record<string, any>,
    traceId: string
  ): Promise<void> {
    if (workflow && typeof workflow.create === "function") {
      await this.taskRepo.insertLog(taskId, EngineConstants.LOG_LEVEL_INFO, "正在启动工作流编排引擎...");
      const run = await workflow.create({ params: { taskId, taskType, payload } });
      await this.taskRepo.markTaskRunning(taskId, run.id);
      TraceLogger.info("ENGINE", "WORKFLOW_STARTED", traceId, `工作流同步启动成功: taskId=${taskId}, runId=${run.id}`);
    } else {
      TraceLogger.warn("ENGINE", "WORKFLOW_TRIGGER_FAILED", taskId, `未检测到绑定的 TASK_WORKFLOW 实例，工作流进入悬挂状态`);
      await this.taskRepo.insertLog(taskId, EngineConstants.LOG_LEVEL_WARN, "未检测到工作流引擎绑定，任务处于就绪等待状态");
    }
  }

  /**
   * Saga 逆向退款补偿
   */
  private async handleRefundCompensate(userId: string, taskId: string, errorMsg: string, traceId: string): Promise<void> {
    try {
      await this.taskRepo.executeRefundTransaction(userId, taskId, errorMsg);
      TraceLogger.info("ENGINE", "TASK_REFUND_COMPENSATE", taskId, `由于启动故障成功执行逆向退款补偿: userId=${userId}`, userId);
    } catch (refundErr: unknown) {
      TraceLogger.error("ENGINE", "TASK_REFUND_CRITICAL_FAILED", taskId, `严重系统故障：逆向退款补偿事务崩溃! 异常: ${getErrorMessage(refundErr)}`, refundErr, userId);
    }
  }
}
