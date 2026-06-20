
import { CreditReason, creditsLedger } from "@swarm/credits";
import { users } from "@swarm/identity";
import { TraceLogger } from "@swarm/kernel";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";

/**
 * 变动用户积分（增/减），使用 D1 物理事务确保原子性。
 *
 * 相较于 db.batch()，db.transaction() 提供真正的原子性保证：
 * - 任一操作失败则整体回滚
 * - 并发场景下无中间状态
 * - 通过 `returning()` 获取数据库端实际余额，避免客户端计算导致的竞态条件
 */
export async function changeUserCredits(
  db: D1Database,
  userId: string,
  delta: number,
  reason: CreditReason,
  refId: string | null,
  traceId: string
): Promise<number> {
  const drizzleDb = drizzle(db);

  try {
    const newBalance = await drizzleDb.transaction(async (tx) => {
      // 1. 读取当前余额（在事务内，可重复读）
      const userRows = await tx
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, userId));

      if (!userRows || userRows.length === 0) {
        throw new Error("USER_NOT_FOUND");
      }

      const currentCredits = userRows[0].credits;
      const newBal = currentCredits + delta;

      if (newBal < 0) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      // 2. 原子更新积分（数据库端做加法，避免并发覆盖）
      const updated = await tx
        .update(users)
        .set({ credits: sql`credits + ${delta}`, updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId))
        .returning({ credits: users.credits });

      if (!updated || updated.length === 0) {
        throw new Error("USER_NOT_FOUND");
      }

      const actualBalance = updated[0].credits;

      // 3. 写入积分流水
      await tx.insert(creditsLedger).values({
        userId,
        delta,
        balance: actualBalance,
        reason,
        refId,
        createdAt: new Date().toISOString(),
      });

      return actualBalance;
    });

    TraceLogger.info("GATEWAY", "CREDITS_CHANGE_SUCCESS", traceId,
      `积分变动成功: 用户=${userId}, 变动=${delta}, 原因=${reason}, 新余额=${newBalance}`,
      userId, { delta, reason });

    return newBalance;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);

    TraceLogger.error("GATEWAY", "CREDITS_CHANGE_FAILED", traceId,
      `积分变动失败: 用户=${userId}, 变动=${delta}, 原因=${reason}, 错误=${errMsg}`, error, userId);

    if (errMsg === "INSUFFICIENT_CREDITS") {
      throw new Error("账户积分余额不足");
    }
    if (errMsg === "USER_NOT_FOUND") {
      throw new Error("用户不存在");
    }
    if (errMsg.includes("constraint failed")) {
      throw new Error("账户积分余额不足");
    }
    throw error;
  }
}
