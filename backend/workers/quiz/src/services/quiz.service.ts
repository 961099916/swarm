// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/services/quiz.service.ts

import { QuizRepository } from "../repositories/quiz.repository";
import { QuizConstants } from "../constants/quiz.constant";
import {
  LOBBY_MAP_CONFIG, FUN_LOBBY_MAP_CONFIG, STAGE_NPCS_RAW, PORTAL_SVGS
} from "../evaluator/mapConfigs";
import { STAGE_CONFIGS } from "../evaluator/stageConfigs";
import { calculateLocalQuiz, QUIZ_META } from "../evaluator/questions";
import type { AnswerSubmit, NPCChallengeConfig } from "../types";
import { QuizConfig } from "@swarm/quiz";
import { CacheService, TraceLogger } from "@swarm/kernel";
import { CONFIG } from "../config";

export class QuizService {
  constructor(private quizRepo: QuizRepository) {}

  public async getUserQuizLevel(userId: string, kv: KVNamespace, traceId: string): Promise<number> {
    try {
      const cacheKey = `user:quiz:${userId}`;
      let userQuiz = await CacheService.get<any>(kv, cacheKey);
      if (userQuiz === undefined) {
        userQuiz = await this.quizRepo.getUserQuiz(userId);
        if (!userQuiz) {
          await CacheService.setNull(kv, cacheKey, QuizConstants.CACHE_NULL_TTL_SEC).catch(() => {});
          userQuiz = null;
        } else {
          await CacheService.set(kv, cacheKey, userQuiz, QuizConstants.CACHE_USER_QUIZ_TTL_SEC).catch(() => {});
        }
      }
      return userQuiz?.level ?? 1;
    } catch (e: any) {
      TraceLogger.warn("QUIZ", "GET_USER_QUIZ_LEVEL_FAILED", traceId, `读取用户评测等级失败，降级返回1: ${e.message}`, userId);
      return 1;
    }
  }

  public async getMapConfig(stageId: string, userId: string, kv: KVNamespace, traceId: string) {
    const userLevel = await this.getUserQuizLevel(userId, kv, traceId);

    if (stageId === QuizConstants.LOBBY_DEFAULT_STAGE) {
      const filteredObstacles = LOBBY_MAP_CONFIG.obstacles.filter(
        (obs) => !obs.activeUntilLevel || userLevel < obs.activeUntilLevel
      );
      return { ...LOBBY_MAP_CONFIG, obstacles: filteredObstacles };
    }

    if (stageId === QuizConstants.FUN_LOBBY_STAGE) {
      return FUN_LOBBY_MAP_CONFIG;
    }

    const effectiveConfigs = await this.getEffectiveStageConfigs(kv, traceId);
    const stage = effectiveConfigs[stageId];
    if (!stage) throw new Error("STAGE_NOT_FOUND");

    const isStagePassed = await this.checkIsStagePassed(stage, userId, userLevel, traceId);
    const npcList = this.buildNpcList(stageId, isStagePassed);

    return {
      width: 400, height: 400, playerSpawnX: 180, playerSpawnY: 180,
      obstacles: [], npcList,
    };
  }

  private async checkIsStagePassed(stage: any, userId: string, userLevel: number, traceId: string): Promise<boolean> {
    if (userLevel > stage.stageOrder) return true;
    if (userLevel < stage.stageOrder) return false;

    try {
      const progress = await this.quizRepo.getStageProgress(userId, stage.id);
      const passedNpcIds = new Set(
        progress.filter((ch) => ch.passed === 1).map((ch) => ch.npc_id)
      );
      return stage.challenges.every((ch: any) => passedNpcIds.has(ch.npcId));
    } catch (e: any) {
      TraceLogger.error("QUIZ", "GET_STAGE_PASS_STATUS_FAILED", traceId, `判断通关状态异常: ${e.message}`, e, userId);
      return false;
    }
  }

  private buildNpcList(stageId: string, isStagePassed: boolean) {
    const npcList: Record<string, unknown> = {};
    for (const [key, npc] of Object.entries(STAGE_NPCS_RAW)) {
      if (npc.stageId === stageId) {
        npcList[key] = npc;
      }
    }
    if (isStagePassed) {
      npcList[QuizConstants.PORTAL_STONE_NPC_ID] = {
        id: QuizConstants.PORTAL_STONE_NPC_ID, name: QuizConstants.PORTAL_STONE_NPC_NAME,
        x: 80, y: 80, stageId, npcType: QuizConstants.PORTAL_NPC_TYPE,
        dialogueText: QuizConstants.PORTAL_DIALOGUE,
        avatarSvg: PORTAL_SVGS.exit, radius: 35,
      };
    }
    return npcList;
  }

  public async getStageStatus(userId: string, kv: KVNamespace) {
    const cacheKey = `user:quiz:${userId}`;
    let user = await CacheService.get<any>(kv, cacheKey);
    if (user === undefined) {
      user = await this.quizRepo.ensureUserQuiz(userId);
      await CacheService.set(kv, cacheKey, user, QuizConstants.CACHE_USER_QUIZ_TTL_SEC);
    }
    const progress = await this.quizRepo.getAllStageProgress(userId);
    return {
      currentLevel: user.level,
      stageName: CONFIG.getStageNameByLevel(user.level),
      exp: user.exp ?? 0,
      completedCount: user.completed_count ?? 0,
      differentCount: user.different_count ?? 0,
      progress: progress.map((p) => ({
        stageId: p.stage_id,
        npcId: p.npc_id,
        score: p.score,
        total: p.total,
        passed: p.passed === 1,
      })),
    };
  }

  public async getQuestions(stageId: string, npcId: string, kv: KVNamespace, traceId: string) {
    const effectiveConfigs = await this.getEffectiveStageConfigs(kv, traceId);
    const stage = effectiveConfigs[stageId];
    if (stage) {
      const challenge = stage.challenges.find((ch: any) => ch.npcId === npcId);
      if (!challenge) throw new Error("CHALLENGE_NOT_FOUND");
      return challenge.questions.map((q: any) => ({
        id: q.id, text: q.text, options: q.options,
      }));
    }

    const quizMeta = QUIZ_META[npcId as keyof typeof QUIZ_META];
    if (!quizMeta) throw new Error("QUIZ_META_NOT_FOUND");
    return quizMeta.questions.map((q) => ({
      id: q.id, text: q.text, options: q.options, inkblotSvg: q.inkblotSvg,
    }));
  }

  public async submitAnswers(params: {
    userId: string;
    stageId: string;
    npcId: string;
    answers: AnswerSubmit[];
    kv: KVNamespace;
    traceId: string;
  }) {
    const { userId, stageId, npcId, answers, kv, traceId } = params;
    let score = 0;
    let total = 0;

    const effectiveConfigs = await this.getEffectiveStageConfigs(kv, traceId);
    const stage = effectiveConfigs[stageId];
    if (stage) {
      const challenge = stage.challenges.find((ch: any) => ch.npcId === npcId);
      if (challenge) {
        total = challenge.questions.length;
        score = answers.filter((a) => {
          const q = challenge.questions.find((qq: any) => qq.id === a.questionId);
          return q && q.correctId === a.selectedOptionId;
        }).length;
      }
    }

    let stageLevelUp = false;
    let nextLevelName: string | undefined;
    let stageHistoryId: string | undefined;

    const passThreshold = await QuizConfig.getQuizPassThreshold(this.quizRepo.db);
    const expStagePass = await QuizConfig.getExpStagePass(this.quizRepo.db);
    const expQuizComplete = await QuizConfig.getExpQuizComplete(this.quizRepo.db);

    if (total > 0) {
      const challenge = stage?.challenges.find((ch: any) => ch.npcId === npcId);
      await this.quizRepo.saveStageProgress(userId, stageId, npcId, score, total);

      const passed = score >= total * passThreshold;
      stageHistoryId = crypto.randomUUID();
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

      await this.quizRepo.saveTestHistory({
        id: stageHistoryId,
        userId,
        testId: `${stageId}/${npcId}`,
        testTitle: challenge?.npcName || npcId,
        testType: QuizConstants.TEST_TYPE_STUDY,
        resultCode: passed ? "PASSED" : "FAILED",
        resultName: passed ? "成绩合格" : "不合格",
        rawScores: JSON.stringify({ score, total, passed, percentage }),
      });

      if (passed) {
        const { previousLevel, newLevel } = await this.quizRepo.addExp(userId, expStagePass);
        if (newLevel > previousLevel) {
          stageLevelUp = true;
          nextLevelName = CONFIG.getStageNameByLevel(newLevel);
        }
      }
    }

    let result: ReturnType<typeof calculateLocalQuiz> | null = null;
    const quizMeta = QUIZ_META[npcId as keyof typeof QUIZ_META];
    if (quizMeta) {
      result = calculateLocalQuiz(npcId, answers);
      if (result) {
        const existingHistory = await this.quizRepo.getTestHistory(userId, 1, 0);
        const isNewType = !existingHistory.some((h) => h.test_id === npcId);

        await this.quizRepo.saveTestHistory({
          id: crypto.randomUUID(),
          userId,
          testId: npcId,
          testTitle: quizMeta.title,
          testType: quizMeta.type,
          resultCode: String(result.code),
          resultName: String(result.name),
          rawScores: JSON.stringify(result.scores ?? {}),
        });
        await this.quizRepo.incrementCompleted(userId, isNewType);
        await this.quizRepo.addExp(userId, expQuizComplete);
      }
    }

    await CacheService.delete(kv, `user:quiz:${userId}`).catch(() => {});
    TraceLogger.info("QUIZ", "SUBMIT_ANSWERS", traceId, `用户提交试题解答成功 npc=${npcId}, 分数=${score}`, userId);

    return {
      score,
      total,
      passed: total > 0 ? score >= total * passThreshold : false,
      result,
      levelUp: stageLevelUp,
      nextLevelName,
      historyId: stageHistoryId,
    };
  }

  public async calculateQuiz(params: {
    userId: string;
    testId: string;
    answers: AnswerSubmit[];
    kv: KVNamespace;
    traceId: string;
  }) {
    const { userId, testId, answers, kv, traceId } = params;
    const quizMeta = QUIZ_META[testId as keyof typeof QUIZ_META];
    if (!quizMeta) throw new Error("QUIZ_META_NOT_FOUND");

    const result = calculateLocalQuiz(testId, answers);
    if (!result) throw new Error("CALCULATE_FAILED");

    const existingHistory = await this.quizRepo.getTestHistory(userId, 1, 0);
    const isNewType = !existingHistory.some((h) => h.test_id === testId);

    await this.quizRepo.saveTestHistory({
      id: crypto.randomUUID(),
      userId,
      testId,
      testTitle: quizMeta.title,
      testType: quizMeta.type,
      resultCode: String(result.code),
      resultName: String(result.name),
      rawScores: JSON.stringify(result.scores ?? {}),
    });

    const expQuizCalculate = await QuizConfig.getExpQuizCalculate(this.quizRepo.db);
    await this.quizRepo.incrementCompleted(userId, isNewType);
    await this.quizRepo.addExp(userId, expQuizCalculate);

    await CacheService.delete(kv, `user:quiz:${userId}`).catch(() => {});
    TraceLogger.info("QUIZ", "CALCULATE_TEST", traceId, `纯测评计算成功 testId=${testId}`, userId);

    return result;
  }

  public async getTestHistory(userId: string, limit: number, offset: number) {
    return await this.quizRepo.getTestHistory(userId, limit, offset);
  }

  public async deleteTestHistory(historyId: string, userId: string) {
    return await this.quizRepo.deleteTestHistory(historyId, userId);
  }

  private async getEffectiveStageConfigs(kv: KVNamespace, traceId: string): Promise<any> {
    const cacheKey = "system:quiz:stage_configs";
    try {
      let configs = await CacheService.get<any>(kv, cacheKey);
      if (configs === undefined) {
        let dbConfigs = await this.quizRepo.getStageConfigsFromDb();
        
        // 若数据库为空（首次运行），自动物理初始化，将默认题库写入结构化表
        if (!dbConfigs || Object.keys(dbConfigs).length === 0) {
          TraceLogger.info("QUIZ", "INIT_DB_STAGE_CONFIGS", traceId, "检测到动态配置表为空，执行默认关系题库物理初始化...");
          await this.quizRepo.saveStageConfigsToDb(STAGE_CONFIGS);
          dbConfigs = STAGE_CONFIGS;
        }
        
        configs = dbConfigs;
        await CacheService.set(kv, cacheKey, configs, 3600).catch(() => {});
      }
      return configs;
    } catch (err: any) {
      TraceLogger.warn("QUIZ", "GET_STAGE_CONFIGS_FAILED", traceId, `动态加载关卡配置失败，降级回退至硬编码: ${err.message}`);
      return STAGE_CONFIGS;
    }
  }

  public async resetUserProgress(userId: string, kv: KVNamespace, traceId: string): Promise<boolean> {
    await this.quizRepo.resetUserProgress(userId);
    await CacheService.delete(kv, `user:quiz:${userId}`).catch(() => {});
    TraceLogger.info("QUIZ", "ADMIN_RESET_USER_PROGRESS", traceId, `管理员重置了用户评测进度与等级`, userId);
    return true;
  }

  public async getQuizConfigs(traceId: string): Promise<{ key: string; value: string }[]> {
    const dbConfigs = await this.quizRepo.getStageConfigsFromDb();
    let configVal = JSON.stringify(dbConfigs);
    if (!dbConfigs || Object.keys(dbConfigs).length === 0) {
      configVal = JSON.stringify(STAGE_CONFIGS);
    }
    return [
      { key: "stage_configs", value: configVal }
    ];
  }

  public async updateQuizConfigs(configs: { key: string; value: string }[], kv: KVNamespace, traceId: string): Promise<void> {
    for (const c of configs) {
      if (c.key === "stage_configs") {
        const parsedJson = JSON.parse(c.value);
        await this.quizRepo.saveStageConfigsToDb(parsedJson);
        await CacheService.delete(kv, "system:quiz:stage_configs").catch(() => {});
      } else {
        await this.quizRepo.saveSystemConfig(c.key, c.value);
      }
    }
    TraceLogger.info("QUIZ", "ADMIN_UPDATE_QUIZ_CONFIGS", traceId, `管理员更新了评测系统配置（已同步写入结构化关系表并强制更新缓存）`);
  }
}
