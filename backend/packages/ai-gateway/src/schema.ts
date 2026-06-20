import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * model_configs — 模型路由配置
 */
export const modelConfigs = sqliteTable("model_configs", {
  id: text("id").primaryKey(),
  purpose: text("purpose").notNull(),
  provider: text("provider").default("workers-ai").notNull(),
  modelName: text("model_name").notNull(),
  displayName: text("display_name"),
  isDefault: integer("is_default").default(0).notNull(),
  isActive: integer("is_active").default(1).notNull(),
  rateLimitRpm: integer("rate_limit_rpm").default(30).notNull(),
  rateLimitTpm: integer("rate_limit_tpm").default(100000).notNull(),
  costPer1kInput: integer("cost_per_1k_input").default(0).notNull(),
  costPer1kOutput: integer("cost_per_1k_output").default(0).notNull(),
  configJson: text("config_json").default("{}").notNull(),
  priority: integer("priority").default(0).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * ai_call_logs — AI 调用日志
 */
export const aiCallLogs = sqliteTable("ai_call_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traceId: text("trace_id").notNull(),
  purpose: text("purpose").notNull(),
  provider: text("provider").notNull(),
  modelName: text("model_name").notNull(),
  userId: text("user_id"),
  agentId: text("agent_id"),
  taskId: text("task_id"),
  kbId: text("kb_id"),
  inputTokens: integer("input_tokens").default(0).notNull(),
  outputTokens: integer("output_tokens").default(0).notNull(),
  latencyMs: integer("latency_ms").default(0).notNull(),
  status: text("status").default("SUCCESS").notNull(),
  errorMessage: text("error_message"),
  costUsd: integer("cost_usd").default(0).notNull(),
  createdAt: text("created_at").notNull(),
});

/**
 * user_rate_limits — 用户级速率限制
 */
export const userRateLimits = sqliteTable("user_rate_limits", {
  userId: text("user_id").notNull(),
  purpose: text("purpose").notNull(),
  minuteBucket: text("minute_bucket").notNull(),
  callCount: integer("call_count").default(0).notNull(),
  tokenCount: integer("token_count").default(0).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.purpose, table.minuteBucket] }),
}));
