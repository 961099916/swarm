import { type UserRow, users } from "@swarm/identity";

/**
 * Drizzle ORM 工具函数
 *
 * 提供 Drizzle 行数据到传统 UserRow 类型的转换函数，
 * 消除 authMiddleware.ts 和 handlers/auth.ts 之间的重复代码。
 */

/**
 * 将 Drizzle 查询返回的用户行映射为 UserRow (snake_case) 类型
 */
export function mapDrizzleUserToRow(row: typeof users.$inferSelect): UserRow {
  return {
    id: row.id,
    wx_open_id: row.wxOpenId,
    nickname: row.nickname,
    avatar_url: row.avatarUrl,
    role: row.role as UserRow["role"],
    credits: row.credits,
    token_version: row.tokenVersion,
    is_banned: row.isBanned,
    banned_reason: row.bannedReason,
    invited_by: row.invitedBy,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

/**
 * 从 Drizzle 查询结果数组中提取第一个用户行（如果存在）
 */
export function findFirstUser(
  results: Array<typeof users.$inferSelect>
): UserRow | null {
  return results && results.length > 0 ? mapDrizzleUserToRow(results[0]) : null;
}
