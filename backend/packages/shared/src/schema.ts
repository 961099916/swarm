
// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/packages/shared/src/schema.ts
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// 1. users表
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  wxOpenId: text("wx_open_id").notNull().unique(),
  nickname: text("nickname"),
  avatarUrl: text("avatar_url"),
  role: text("role").default("FREE_USER").notNull(),
  credits: integer("credits").default(0).notNull(),
  tokenVersion: integer("token_version").default(1).notNull(),
  isBanned: integer("is_banned").default(0).notNull(),
  bannedReason: text("banned_reason"),
  invitedBy: text("invited_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

// 2. role_permissions表
export const rolePermissions = sqliteTable("role_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role").notNull(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
});

// 3. tasks表
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  taskType: text("task_type").notNull(),
  status: text("status").default("PENDING").notNull(),
  payload: text("payload").notNull(),
  workflowRunId: text("workflow_run_id"),
  creditsCost: integer("credits_cost").default(0).notNull(),
  resultSummary: text("result_summary"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

// 4. task_logs表
export const taskLogs = sqliteTable("task_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: text("task_id").notNull().references(() => tasks.id),
  level: text("level").default("INFO").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull()
});

// 5. user_invitations表
export const userInvitations = sqliteTable("user_invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inviterId: text("inviter_id").notNull().references(() => users.id),
  inviteeId: text("invitee_id").notNull().unique().references(() => users.id),
  bonusGiven: integer("bonus_given").default(0).notNull(),
  createdAt: text("created_at").notNull()
});

// 6. ad_reward_logs表
export const adRewardLogs = sqliteTable("ad_reward_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  adTokenHash: text("ad_token_hash").notNull().unique(),
  creditsAdded: integer("credits_added").notNull(),
  createdAt: text("created_at").notNull()
});

// 7. credits_ledger表
export const creditsLedger = sqliteTable("credits_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  delta: integer("delta").notNull(),
  balance: integer("balance").notNull(),
  reason: text("reason").notNull(),
  refId: text("ref_id"),
  createdAt: text("created_at").notNull()
});

// 8. agents表
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  avatar: text("avatar").default("").notNull(),
  role: text("role").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull(),
  tools: text("tools").default("[]").notNull(),
  isPreset: integer("is_preset").default(0).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

// 9. admin_audit_logs 表
export const adminAuditLogs = sqliteTable("admin_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  detail: text("detail"),
  createdAt: text("created_at").notNull()
});

// ══════════════════════════════════════════════════
// 10~13. 测评模块表 (Quiz Module)
// ══════════════════════════════════════════════════

// 10. quiz_users 表 — 测评用户等级/经验
export const quizUsers = sqliteTable("quiz_users", {
  userId: text("user_id").primaryKey().references(() => users.id),
  exp: integer("exp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  differentCount: integer("different_count").default(0).notNull(),
  completedCount: integer("completed_count").default(0).notNull(),
  updatedAt: text("updated_at"),
  createdAt: text("created_at").notNull()
});

// 11. test_history 表 — 测评历史
export const testHistory = sqliteTable("test_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  testId: text("test_id").notNull(),
  testTitle: text("test_title").notNull(),
  testType: text("test_type").notNull(),
  resultCode: text("result_code").notNull(),
  resultName: text("result_name").notNull(),
  rawScores: text("raw_scores").notNull(),
  createdAt: text("created_at").notNull()
});

// 12. user_stage_progress 表 — 关卡进度
export const userStageProgress = sqliteTable("user_stage_progress", {
  userId: text("user_id").notNull().references(() => users.id),
  stageId: text("stage_id").notNull(),
  npcId: text("npc_id").notNull(),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  passed: integer("passed").default(0).notNull(),
  updatedAt: text("updated_at").notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.stageId, table.npcId] })
}));

// 13. system_configs 表 — 系统配置 KV
export const systemConfigs = sqliteTable("system_configs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull()
});

// 14. tools 表 — 动态工具注册与执行表
export const tools = sqliteTable("tools", {
  name: text("name").primaryKey(),
  description: text("description").notNull(),
  category: text("category").default("general").notNull(),
  endpoint: text("endpoint"),
  method: text("method").default("GET").notNull(),
  headers: text("headers").default("{}").notNull(),
  bodyTemplate: text("body_template"),
  script: text("script"),
  paramsSchema: text("params_schema").default("[]").notNull(),
  responseSelector: text("response_selector"),
  enabled: integer("enabled").default(1).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

