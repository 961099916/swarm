// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/controllers/quiz.controller.ts

import { ApiRes, TraceLogger, getErrorMessage } from "@swarm/kernel";
import { QuizService } from "../services/quiz.service";
import type { AnswerSubmit } from "../types";
import { QuizConfig } from "@swarm/quiz";

export class QuizController {
  constructor(private quizService: QuizService) {}

  public async getMapConfig(request: Request, kv: KVNamespace, userId: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const stageId = url.searchParams.get("stageId") || "lobby";
      const config = await this.quizService.getMapConfig(stageId, userId, kv, traceId);
      return ApiRes.success(config, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "STAGE_NOT_FOUND") {
        return ApiRes.error(1030, `未找到关卡地图`, traceId);
      }
      return ApiRes.internalError("获取地图配置失败", traceId);
    }
  }

  public async getStageStatus(kv: KVNamespace, userId: string, traceId: string): Promise<Response> {
    try {
      const status = await this.quizService.getStageStatus(userId, kv);
      return ApiRes.success(status, traceId);
    } catch (err) {
      TraceLogger.error("QUIZ", "GET_STAGE_STATUS_FAILED", traceId, `获取关卡进度失败: ${getErrorMessage(err)}`, err, userId);
      return ApiRes.internalError("获取进度失败", traceId);
    }
  }

  public async getQuestions(request: Request, stageId: string, npcId: string, kv: KVNamespace, traceId: string): Promise<Response> {
    try {
      const questions = await this.quizService.getQuestions(stageId, npcId, kv, traceId);
      return ApiRes.success(questions, traceId);
    } catch (err) {
      return ApiRes.error(1030, "找不到指定的考核题库", traceId);
    }
  }

  public async submitAnswers(
    request: Request,
    stageId: string,
    npcId: string,
    kv: KVNamespace,
    userId: string,
    traceId: string
  ): Promise<Response> {
    try {
      const body = await request.json() as { answers?: AnswerSubmit[] };
      if (!body.answers || !Array.isArray(body.answers) || body.answers.length === 0) {
        return ApiRes.badRequest("参数错误：answers 不能为空", traceId);
      }

      const data = await this.quizService.submitAnswers({
        userId,
        stageId,
        npcId,
        answers: body.answers,
        kv,
        traceId,
      });

      return ApiRes.success(data, traceId);
    } catch (err) {
      return ApiRes.internalError("提交试题解答异常", traceId);
    }
  }

  public async calculateQuiz(request: Request, kv: KVNamespace, userId: string, traceId: string): Promise<Response> {
    try {
      const body = await request.json() as { testId?: string; answers?: AnswerSubmit[] };
      if (!body.testId || !body.answers || !Array.isArray(body.answers) || body.answers.length === 0) {
        return ApiRes.badRequest("参数错误：testId 和 answers 不能为空", traceId);
      }

      const result = await this.quizService.calculateQuiz({
        userId,
        testId: body.testId,
        answers: body.answers,
        kv,
        traceId,
      });

      return ApiRes.success(result, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "QUIZ_META_NOT_FOUND") return ApiRes.error(1030, "找不到指定的题库", traceId);
      return ApiRes.internalError("测评结果处理异常", traceId);
    }
  }

  public async getTestHistory(request: Request, db: D1Database, userId: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const maxLimit = await QuizConfig.getTestHistoryMaxLimit(db);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), maxLimit);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

      const list = await this.quizService.getTestHistory(userId, limit, offset);
      return ApiRes.success(list, traceId);
    } catch (err) {
      TraceLogger.error("QUIZ", "GET_HISTORY_FAILED", traceId, `获取测评历史异常: ${getErrorMessage(err)}`, err, userId);
      return ApiRes.internalError("获取评测历史失败", traceId);
    }
  }

  public async getTestHistoryRecord(userId: string, historyId: string, traceId: string): Promise<Response> {
    try {
      const list = await this.quizService.getTestHistory(userId, 100, 0);
      const record = list.find((h) => h.id === historyId);
      if (!record) {
        return ApiRes.error(1030, "未找到该记录", traceId);
      }
      return ApiRes.success(record, traceId);
    } catch (err) {
      return ApiRes.internalError("获取历史记录异常", traceId);
    }
  }

  public async deleteTestHistory(historyId: string, userId: string, traceId: string): Promise<Response> {
    try {
      const success = await this.quizService.deleteTestHistory(historyId, userId);
      if (!success) {
        return ApiRes.error(1030, "未找到该记录或无权限删除", traceId);
      }
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("删除历史记录失败", traceId);
    }
  }

  public async resetUserProgress(request: Request, kv: KVNamespace, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const targetUserId = url.searchParams.get("userId");
      if (!targetUserId) {
        return ApiRes.badRequest("缺少 target userId", traceId);
      }
      await this.quizService.resetUserProgress(targetUserId, kv, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("重置用户评测进度失败", traceId);
    }
  }

  public async getQuizConfigs(traceId: string): Promise<Response> {
    try {
      const configs = await this.quizService.getQuizConfigs(traceId);
      return ApiRes.success(configs, traceId);
    } catch (err) {
      return ApiRes.internalError("获取评测系统配置失败", traceId);
    }
  }

  public async updateQuizConfigs(request: Request, kv: KVNamespace, traceId: string): Promise<Response> {
    try {
      const body = await request.json() as { configs?: { key: string; value: string }[] };
      if (!body.configs || !Array.isArray(body.configs)) {
        return ApiRes.badRequest("参数错误：configs 字段有误", traceId);
      }
      await this.quizService.updateQuizConfigs(body.configs, kv, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("修改评测系统配置失败", traceId);
    }
  }
}
