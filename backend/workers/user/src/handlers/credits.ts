// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/handlers/credits.ts

import { BindInviteReq, AdRewardReq, creditsLedger, userInvitations, adRewardLogs, INVITE_REWARD, AD_REWARD } from "@swarm/credits";
import { users } from "@swarm/identity";
import { TraceLogger } from "@swarm/kernel";
import { getDrizzleDb } from "../utils/drizzleInstance";
import { ResponseBuilder } from "../utils/response";
import { RequiredFieldsValidator, ValidatorChain } from "../utils/validator";
import { verifyAdToken } from "../utils/security";
import { eq, sql, and, desc, gt, lt } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";

function buildBindInviteValidatorChain(): ValidatorChain<BindInviteReq> {
  return new ValidatorChain<BindInviteReq>().add(new RequiredFieldsValidator(["inviterId"]));
}

function buildAdRewardValidatorChain(): ValidatorChain<AdRewardReq> {
  return new ValidatorChain<AdRewardReq>().add(new RequiredFieldsValidator(["adToken"]));
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 执行绑定邀请的强一致物理本地事务
 */
async function executeBindInviteTransaction(
  db: D1Database,
  userId: string,
  inviterId: string,
  traceId: string
): Promise<void> {
  const drizzleDb = getDrizzleDb(db);
  const now = new Date().toISOString();

  await drizzleDb.transaction(async (tx: DrizzleD1Database) => {
    // 1. 原子更新被邀请人 invitedBy，且更新 credits (+INVITE_REWARD)
    // 条件：被邀请人的 invited_by 必须为 NULL，确保不能重复绑定
    const updateeRes = await tx
      .update(users)
      .set({ invitedBy: inviterId, credits: sql`credits + ${INVITE_REWARD}`, updatedAt: now })
      .where(and(eq(users.id, userId), sql`invited_by IS NULL`))
      .returning({ credits: users.credits });

    if (updateeRes.length === 0) {
      throw new Error("ALREADY_BOUND_OR_USER_MISSING");
    }

    const myNewBalance = updateeRes[0].credits;

    // 2. 插入邀请关系记录表 (防止主键冲突)
    await tx.insert(userInvitations).values({
      inviterId,
      inviteeId: userId,
      bonusGiven: INVITE_REWARD,
      createdAt: now
    });

    // 3. 写入被邀请人积分流水
    await tx.insert(creditsLedger).values({
      userId,
      delta: INVITE_REWARD,
      balance: myNewBalance,
      reason: "INVITE_BONUS",
      refId: inviterId,
      createdAt: now
    });

    // 4. 原子更新邀请人积分 (+INVITE_REWARD)
    const inviterRes = await tx
      .update(users)
      .set({ credits: sql`credits + ${INVITE_REWARD}`, updatedAt: now })
      .where(eq(users.id, inviterId))
      .returning({ credits: users.credits });

    if (inviterRes.length === 0) {
      throw new Error("INVITER_MISSING"); // 邀请人不存在触发回滚
    }

    const inviterNewBalance = inviterRes[0].credits;

    // 5. 写入邀请人积分流水
    await tx.insert(creditsLedger).values({
      userId: inviterId,
      delta: INVITE_REWARD,
      balance: inviterNewBalance,
      reason: "INVITE_BONUS",
      refId: userId,
      createdAt: now
    });
  });
}

/**
 * 绑定邀请人接口 (POST /api/v1/credits/bind-invite)
 */
export async function handleBindInvite(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as BindInviteReq;
    const validationError = buildBindInviteValidatorChain().validate(body);
    if (validationError) return ResponseBuilder.badRequest(validationError, traceId);

    const { inviterId } = body;
    if (inviterId === userId) {
      return ResponseBuilder.badRequest("不能绑定自己的邀请码哦", traceId);
    }

    const drizzleDb = getDrizzleDb(db);

    // 查询邀请人是否存在
    const inviterResult = await drizzleDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, inviterId));
      
    if (!inviterResult || inviterResult.length === 0) {
      return ResponseBuilder.badRequest("邀请码无效，请核对后重试", traceId);
    }

    // 执行强一致性本地事务绑定
    await executeBindInviteTransaction(db, userId, inviterId, traceId);
    
    TraceLogger.info("USER", "BIND_INVITE_SUCCESS", traceId, `邀请关系绑定成功: 邀请人=${inviterId}`, userId);
    return ResponseBuilder.success({ success: true }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("USER", "BIND_INVITE_FAILED", traceId, `绑定邀请失败: getErrorMessage(error)`, error, userId);
    
    if (error.message === "ALREADY_BOUND_OR_USER_MISSING") {
      return ResponseBuilder.badRequest("您已绑定过邀请人，请勿重复操作", traceId);
    }
    if (error.message && error.message.includes("UNIQUE constraint")) {
      return ResponseBuilder.badRequest("邀请关系已建立，请勿重复操作", traceId);
    }
    return ResponseBuilder.internalError("系统绑定邀请异常，请稍后重试", traceId);
  }
}

/**
 * 执行加积分的强一致物理本地事务
 */
async function executeAdRewardTransaction(
  db: D1Database,
  userId: string,
  tokenHash: string
): Promise<number> {
  const drizzleDb = getDrizzleDb(db);
  const now = new Date().toISOString();

  return await drizzleDb.transaction(async (tx: DrizzleD1Database) => {
    // 1. 唯一性去重校验（防重放）
    const exists = await tx
      .select({ id: adRewardLogs.id })
      .from(adRewardLogs)
      .where(eq(adRewardLogs.adTokenHash, tokenHash));

    if (exists && exists.length > 0) {
      throw new Error("AD_REWARD_CLAIMED");
    }

    // 2. 插入去重日志
    await tx.insert(adRewardLogs).values({
      userId,
      adTokenHash: tokenHash,
      creditsAdded: AD_REWARD,
      createdAt: now
    });

    // 3. 原子增加用户积分并获取最新值
    const userRes = await tx
      .update(users)
      .set({ credits: sql`credits + ${AD_REWARD}`, updatedAt: now })
      .where(eq(users.id, userId))
      .returning({ credits: users.credits });

    if (userRes.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    const newBalance = userRes[0].credits;

    // 4. 写入账本流水
    await tx.insert(creditsLedger).values({
      userId,
      delta: AD_REWARD,
      balance: newBalance,
      reason: "AD_REWARD",
      refId: tokenHash,
      createdAt: now
    });

    return newBalance;
  });
}

/**
 * 观看广告赚取积分接口 (POST /api/v1/credits/reward)
 */
export async function handleAdReward(
  request: Request,
  db: D1Database,
  env: { JWT_SECRET: string },
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as AdRewardReq;
    const validationError = buildAdRewardValidatorChain().validate(body);
    if (validationError) return ResponseBuilder.badRequest(validationError, traceId);

    const { adToken } = body;

    // 1. 安全校验：验证广告令牌的签名、用户归属、时效重放
    const verifyRes = await verifyAdToken(adToken, env.JWT_SECRET, userId, traceId);
    if (!verifyRes.success) {
      return ResponseBuilder.badRequest(verifyRes.errorMsg || "广告令牌校验失败", traceId);
    }

    // 2. 计算 Token 哈希值用于去重
    const tokenHash = await sha256(adToken);

    // 3. 执行物理事务发放积分并记录流水
    const newBalance = await executeAdRewardTransaction(db, userId, tokenHash);

    TraceLogger.info("USER", "AD_REWARD_CLAIM_SUCCESS", traceId, `观看广告得积分成功: 用户=${userId}, 积分+=${AD_REWARD}, 新余额=${newBalance}`, userId);
    return ResponseBuilder.success({ addedCredits: AD_REWARD, newBalance }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("USER", "AD_REWARD_CLAIM_FAILED", traceId, `领广告积分失败: getErrorMessage(error)`, error, userId);
    
    if (error.message === "AD_REWARD_CLAIMED") {
      return ResponseBuilder.badRequest("该广告奖励已被领用，请勿重复领取", traceId);
    }
    return ResponseBuilder.internalError("系统处理广告奖励异常，请稍后重试", traceId);
  }
}

/**
 * 积分收支流水历史接口 (GET /api/v1/credits/history)
 */
export async function handleCreditsHistory(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "ALL";
    const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));

    const drizzleDb = getDrizzleDb(db);
    const conditions = [eq(creditsLedger.userId, userId)];

    if (type === "INCOME") {
      conditions.push(gt(creditsLedger.delta, 0));
    } else if (type === "OUTCOME") {
      conditions.push(lt(creditsLedger.delta, 0));
    }

    const results = await drizzleDb
      .select()
      .from(creditsLedger)
      .where(and(...conditions))
      .orderBy(desc(creditsLedger.createdAt))
      .limit(limit)
      .offset(offset);

    return ResponseBuilder.success(results, traceId);
  } catch (error: unknown) {
    TraceLogger.error("USER", "CREDITS_HISTORY_FAILED", traceId, `查询积分流水失败: getErrorMessage(error)`, error, userId);
    return ResponseBuilder.internalError("系统查询积分记录异常", traceId);
  }
}
