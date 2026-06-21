// File: packages/quiz/src/constants.ts
/// <reference types="@cloudflare/workers-types" />
import { ConfigService } from "@swarm/kernel";

/**
 * QuizConfig — 测评关卡动态配置读取门面
 */
export const QuizConfig = {
  /** 每级所需经验值 */
  async getExpPerLevel(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "quiz.exp_per_level");
  },

  /** 关卡通过阈值 (分数占比) */
  async getQuizPassThreshold(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "quiz.quiz_pass_threshold");
  },

  /** 通过关卡奖励经验 */
  async getExpStagePass(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "quiz.exp_stage_pass");
  },

  /** 完成测评奖励经验 */
  async getExpQuizComplete(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "quiz.exp_quiz_complete");
  },

  /** 纯测评计算奖励经验 */
  async getExpQuizCalculate(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "quiz.exp_quiz_calculate");
  },

  /** 测评历史列表最大返回条数 */
  async getTestHistoryMaxLimit(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "quiz.test_history_max_limit");
  }
};
