// File: packages/credits/src/index.ts
/**
 * @swarm/credits — 积分经济限界上下文
 *
 * Bounded Context (DDD): 积分管理、广告奖励、邀请系统
 * Aggregate Roots: CreditsLedger (积分流水聚合)
 */

export { creditsLedger, adRewardLogs, userInvitations } from './infrastructure/db/schema';
export type {
  CreditReason, CreditsLedgerRow, AdRewardLogRow, UserInvitationRow,
  BindInviteReq, AdRewardReq,
} from './types';
export { CreditsConfig } from './constants';
