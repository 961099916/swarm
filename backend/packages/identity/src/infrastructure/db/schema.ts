// File: packages/identity/src/infrastructure/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * users — 用户主表
 */
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
  updatedAt: text("updated_at").notNull(),
});

/**
 * role_permissions — RBAC 权限矩阵
 */
export const rolePermissions = sqliteTable("role_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role").notNull(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
});
