// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/repositories/user.repository.ts

import { users } from "@swarm/identity";
import { creditsLedger, userInvitations, adRewardLogs } from "@swarm/credits";
import { getDrizzleDb } from "../utils/drizzleInstance";
import { eq, sql, and, desc, gt, lt } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { UserConstants } from "../constants/user.constant";

export class UserRepository {
  constructor(public readonly db: D1Database) {}

  private getDrizzle() {
    return getDrizzleDb(this.db);
  }

  public async findUserById(userId: string) {
    const drizzleDb = this.getDrizzle();
    const results = await drizzleDb.select().from(users).where(eq(users.id, userId));
    return results[0] || null;
  }

  public async findUserByOpenId(openId: string) {
    const drizzleDb = this.getDrizzle();
    const results = await drizzleDb.select().from(users).where(eq(users.wxOpenId, openId));
    return results[0] || null;
  }

  public async updateUser(userId: string, updates: Record<string, any>) {
    const drizzleDb = this.getDrizzle();
    await drizzleDb.update(users).set(updates).where(eq(users.id, userId));
  }

  public async registerNewUserTransaction(params: {
    newUserId: string;
    openId: string;
    nickname?: string;
    avatarUrl?: string;
    invitedBy: string | null;
    finalCredits: number;
    initialCredits: number;
    inviteReward: number;
    now: string;
  }): Promise<any> {
    const drizzleDb = this.getDrizzle();
    const { newUserId, openId, nickname, avatarUrl, invitedBy, finalCredits, initialCredits, inviteReward, now } = params;

    return await drizzleDb.transaction(async (tx: DrizzleD1Database) => {
      await tx.insert(users).values({
        id: newUserId,
        wxOpenId: openId,
        nickname: nickname || UserConstants.DEFAULT_NICKNAME,
        avatarUrl: avatarUrl || "",
        role: UserConstants.ROLE_FREE_USER,
        credits: finalCredits,
        tokenVersion: UserConstants.INITIAL_TOKEN_VERSION,
        isBanned: UserConstants.STATUS_NORMAL,
        invitedBy,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(creditsLedger).values({
        userId: newUserId,
        delta: initialCredits,
        balance: initialCredits,
        reason: "ADMIN_ADJUST",
        refId: "SYSTEM_REGISTER",
        createdAt: now,
      });

      if (invitedBy) {
        await tx.insert(creditsLedger).values({
          userId: newUserId,
          delta: inviteReward,
          balance: finalCredits,
          reason: "INVITE_BONUS",
          refId: invitedBy,
          createdAt: now,
        });

        await tx.insert(userInvitations).values({
          inviterId: invitedBy,
          inviteeId: newUserId,
          bonusGiven: inviteReward,
          createdAt: now,
        });

        const inviterUpdate = await tx
          .update(users)
          .set({ credits: sql`credits + ${inviteReward}`, updatedAt: now })
          .where(eq(users.id, invitedBy))
          .returning({ credits: users.credits });

        if (inviterUpdate.length > 0) {
          await tx.insert(creditsLedger).values({
            userId: invitedBy,
            delta: inviteReward,
            balance: inviterUpdate[0].credits,
            reason: "INVITE_BONUS",
            refId: newUserId,
            createdAt: now,
          });
        }
      }

      const newUserList = await tx.select().from(users).where(eq(users.id, newUserId));
      return newUserList[0];
    });
  }

  public async executeBindInviteTransaction(params: {
    userId: string;
    inviterId: string;
    inviteReward: number;
    now: string;
  }): Promise<void> {
    const drizzleDb = this.getDrizzle();
    const { userId, inviterId, inviteReward, now } = params;

    await drizzleDb.transaction(async (tx: DrizzleD1Database) => {
      const updateeRes = await tx
        .update(users)
        .set({ invitedBy: inviterId, credits: sql`credits + ${inviteReward}`, updatedAt: now })
        .where(and(eq(users.id, userId), sql`invited_by IS NULL`))
        .returning({ credits: users.credits });

      if (updateeRes.length === 0) {
        throw new Error("ALREADY_BOUND_OR_USER_MISSING");
      }

      const myNewBalance = updateeRes[0].credits;

      await tx.insert(userInvitations).values({
        inviterId,
        inviteeId: userId,
        bonusGiven: inviteReward,
        createdAt: now,
      });

      await tx.insert(creditsLedger).values({
        userId,
        delta: inviteReward,
        balance: myNewBalance,
        reason: "INVITE_BONUS",
        refId: inviterId,
        createdAt: now,
      });

      const inviterRes = await tx
        .update(users)
        .set({ credits: sql`credits + ${inviteReward}`, updatedAt: now })
        .where(eq(users.id, inviterId))
        .returning({ credits: users.credits });

      if (inviterRes.length === 0) {
        throw new Error("INVITER_MISSING");
      }

      await tx.insert(creditsLedger).values({
        userId: inviterId,
        delta: inviteReward,
        balance: inviterRes[0].credits,
        reason: "INVITE_BONUS",
        refId: userId,
        createdAt: now,
      });
    });
  }

  public async checkAdRewardTokenHashExists(tokenHash: string): Promise<boolean> {
    const drizzleDb = this.getDrizzle();
    const exists = await drizzleDb
      .select({ id: adRewardLogs.id })
      .from(adRewardLogs)
      .where(eq(adRewardLogs.adTokenHash, tokenHash));
    return exists && exists.length > 0;
  }

  public async executeAdRewardTransaction(params: {
    userId: string;
    tokenHash: string;
    adReward: number;
    now: string;
  }): Promise<number> {
    const drizzleDb = this.getDrizzle();
    const { userId, tokenHash, adReward, now } = params;

    return await drizzleDb.transaction(async (tx: DrizzleD1Database) => {
      const exists = await tx
        .select({ id: adRewardLogs.id })
        .from(adRewardLogs)
        .where(eq(adRewardLogs.adTokenHash, tokenHash));

      if (exists && exists.length > 0) {
        throw new Error("AD_REWARD_CLAIMED");
      }

      await tx.insert(adRewardLogs).values({
        userId,
        adTokenHash: tokenHash,
        creditsAdded: adReward,
        createdAt: now,
      });

      const userRes = await tx
        .update(users)
        .set({ credits: sql`credits + ${adReward}`, updatedAt: now })
        .where(eq(users.id, userId))
        .returning({ credits: users.credits });

      if (userRes.length === 0) {
        throw new Error("USER_NOT_FOUND");
      }

      const newBalance = userRes[0].credits;

      await tx.insert(creditsLedger).values({
        userId,
        delta: adReward,
        balance: newBalance,
        reason: "AD_REWARD",
        refId: tokenHash,
        createdAt: now,
      });

      return newBalance;
    });
  }

  public async findCreditsHistory(params: {
    userId: string;
    type: string;
    limit: number;
    offset: number;
  }) {
    const drizzleDb = this.getDrizzle();
    const { userId, type, limit, offset } = params;
    const conditions = [eq(creditsLedger.userId, userId)];

    if (type === UserConstants.FLOW_TYPE_INCOME) {
      conditions.push(gt(creditsLedger.delta, 0));
    } else if (type === UserConstants.FLOW_TYPE_OUTCOME) {
      conditions.push(lt(creditsLedger.delta, 0));
    }

    return await drizzleDb
      .select()
      .from(creditsLedger)
      .where(and(...conditions))
      .orderBy(desc(creditsLedger.createdAt))
      .limit(limit)
      .offset(offset);
  }

  public async createAdminUserDirectly(params: {
    id: string;
    openId: string;
    nickname: string;
    now: string;
  }) {
    const drizzleDb = this.getDrizzle();
    const { id, openId, nickname, now } = params;
    await drizzleDb.insert(users).values({
      id,
      wxOpenId: openId,
      nickname,
      avatarUrl: "",
      role: "ADMIN",
      credits: 999999,
      tokenVersion: 1,
      isBanned: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
}
// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/repositories/user.repository.ts
