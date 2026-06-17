
import { CreditReason, users, creditsLedger } from "@swarm/shared";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";

async function executeCreditsBatch(
  db: D1Database,
  userId: string,
  delta: number,
  newBalance: number,
  reason: CreditReason,
  refId: string | null
): Promise<void> {
  const drizzleDb = drizzle(db);
  const now = new Date().toISOString();
  await drizzleDb.batch([
    drizzleDb
      .update(users)
      .set({ credits: sql`credits + ${delta}`, updatedAt: now })
      .where(eq(users.id, userId)),
    drizzleDb.insert(creditsLedger).values({
      userId,
      delta,
      balance: newBalance,
      reason,
      refId,
      createdAt: now
    })
  ]);
}

/**
 * 变动用户积分（增/减），使用 db.batch 确保原子性，若扣减导致积分小于 0 会触发 CHECK 约束自动回滚
 */
export async function changeUserCredits(
  db: D1Database,
  userId: string,
  delta: number,
  reason: CreditReason,
  refId: string | null,
  traceId: string
): Promise<number> {
  try {
    const drizzleDb = drizzle(db);
    const results = await drizzleDb
      .select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, userId));

    if (!results || results.length === 0) {
      throw new Error("用户不存在");
    }

    const currentCredits = results[0].credits;
    const newBalance = currentCredits + delta;
    if (newBalance < 0) {
      throw new Error("账户积分余额不足");
    }

    await executeCreditsBatch(db, userId, delta, newBalance, reason, refId);
    console.info(`[INFO] [TraceID: ${traceId}] 积分变动成功: 用户=${userId}, 变动=${delta}, 原因=${reason}, 新余额=${newBalance}`);
    return newBalance;
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 积分变动失败: 用户=${userId}, 变动=${delta}, 原因=${reason}, 错误=${error.message}`);
    if (error.message && error.message.includes("constraint failed")) {
      throw new Error("账户积分余额不足");
    }
    throw error;
  }
}
