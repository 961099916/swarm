// File: packages/credits/src/constants.ts
/// <reference types="@cloudflare/workers-types" />
import { ConfigService } from "@swarm/kernel";

/**
 * CreditsConfig — 积分经济参数动态化读取门面
 */
export const CreditsConfig = {
  /** 新用户注册赠送积分 */
  async getInitialCredits(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "credits.initial_credits");
  },

  /** 邀请奖励积分 */
  async getInviteReward(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "credits.invite_reward");
  },

  /** 广告激励积分 */
  async getAdReward(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "credits.ad_reward");
  },

  /** 创建任务消耗积分 */
  async getTaskCost(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "credits.task_cost");
  },

  /** 默认分页大小 */
  async getDefaultPageLimit(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "credits.default_page_limit");
  },

  /** 积分流水分页大小 */
  async getCreditsLimit(db: D1Database): Promise<number> {
    return ConfigService.getNumber(db, "credits.credits_limit");
  }
};
