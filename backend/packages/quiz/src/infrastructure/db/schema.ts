// File: packages/quiz/src/infrastructure/db/schema.ts
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * quiz_users — 测评用户等级/经验
 */
export const quizUsers = sqliteTable("quiz_users", {
  userId: text("user_id").primaryKey(),
  exp: integer("exp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  differentCount: integer("different_count").default(0).notNull(),
  completedCount: integer("completed_count").default(0).notNull(),
  updatedAt: text("updated_at"),
  createdAt: text("created_at").notNull(),
});

/**
 * test_history — 测评历史
 */
export const testHistory = sqliteTable("test_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  testId: text("test_id").notNull(),
  testTitle: text("test_title").notNull(),
  testType: text("test_type").notNull(),
  resultCode: text("result_code").notNull(),
  resultName: text("result_name").notNull(),
  rawScores: text("raw_scores").notNull(),
  createdAt: text("created_at").notNull(),
});

/**
 * user_stage_progress — 关卡进度
 */
export const userStageProgress = sqliteTable("user_stage_progress", {
  userId: text("user_id").notNull(),
  stageId: text("stage_id").notNull(),
  npcId: text("npc_id").notNull(),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  passed: integer("passed").default(0).notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.stageId, table.npcId] }),
}));

/**
 * system_configs — 系统配置 KV
 */
export const systemConfigs = sqliteTable("system_configs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * quiz_stages — 测评关卡年级表
 */
export const quizStages = sqliteTable("quiz_stages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  group: text("stage_group").notNull(),
  order: integer("stage_order").notNull(),
  updatedAt: text("updated_at"),
});

/**
 * quiz_npcs — 导师挑战配置表
 */
export const quizNpcs = sqliteTable("quiz_npcs", {
  id: text("id").primaryKey(),
  stageId: text("stage_id").notNull(),
  name: text("name").notNull(),
  type: text("npc_type").notNull(),
  subjectName: text("subject_name").notNull(),
  requiredScore: integer("required_score").notNull(),
  dialogueLocked: text("dialogue_locked").notNull(),
  dialogueTodo: text("dialogue_todo").notNull(),
  dialoguePassed: text("dialogue_passed").notNull(),
  updatedAt: text("updated_at"),
});

/**
 * quiz_questions — 题库表
 */
export const quizQuestions = sqliteTable("quiz_questions", {
  id: integer("id").primaryKey(),
  npcId: text("npc_id").notNull(),
  text: text("question_text").notNull(),
  options: text("options").notNull(),
  correctId: text("correct_id").notNull(),
  explanation: text("explanation"),
  updatedAt: text("updated_at"),
});
