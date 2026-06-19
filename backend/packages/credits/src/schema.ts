import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * credits_ledger — 积分流水账本
 */
export const creditsLedger = sqliteTable("credits_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  delta: integer("delta").notNull(),
  balance: integer("balance").notNull(),
  reason: text("reason").notNull(),
  refId: text("ref_id"),
  createdAt: text("created_at").notNull(),
});

/**
 * ad_reward_logs — 广告奖励幂等表
 */
export const adRewardLogs = sqliteTable("ad_reward_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  adTokenHash: text("ad_token_hash").notNull().unique(),
  creditsAdded: integer("credits_added").notNull(),
  createdAt: text("created_at").notNull(),
});

/**
 * user_invitations — 邀请记录
 */
export const userInvitations = sqliteTable("user_invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inviterId: text("inviter_id").notNull(),
  inviteeId: text("invitee_id").notNull().unique(),
  bonusGiven: integer("bonus_given").default(0).notNull(),
  createdAt: text("created_at").notNull(),
});
