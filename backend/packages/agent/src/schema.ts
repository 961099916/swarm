import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * agents — 智能体定义表
 */
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
  modelConfigId: text("model_config_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * tasks — 任务主表
 */
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  taskType: text("task_type").notNull(),
  status: text("status").default("PENDING").notNull(),
  payload: text("payload").notNull(),
  workflowRunId: text("workflow_run_id"),
  creditsCost: integer("credits_cost").default(0).notNull(),
  costUsd: real("cost_usd").default(0).notNull(),
  resultSummary: text("result_summary"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * task_logs — 任务日志流
 */
export const taskLogs = sqliteTable("task_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: text("task_id").notNull(),
  level: text("level").default("INFO").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

/**
 * tools — 动态工具注册与执行表
 */
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
  updatedAt: text("updated_at").notNull(),
});

/**
 * admin_audit_logs — 管理操作审计日志
 */
export const adminAuditLogs = sqliteTable("admin_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});
