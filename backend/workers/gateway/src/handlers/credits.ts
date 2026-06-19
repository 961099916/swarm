
import { BindInviteReq, AdRewardReq, userInvitations, creditsLedger, adRewardLogs, INVITE_REWARD, AD_REWARD } from "@swarm/credits";
import { UserRow, users } from "@swarm/identity";
import { TraceLogger } from "@swarm/kernel";
import { ApiRes, getErrorMessage } from "/kernel";
import { RequiredFieldsValidator, ValidatorChain } from "../utils/validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql, and, desc, gt, lt } from "drizzle-orm";

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 校验绑定邀请关系入参
 */
function buildBindInviteValidatorChain(): ValidatorChain<BindInviteReq> {
  return new ValidatorChain<BindInviteReq>().add(new RequiredFieldsValidator(["inviterId"]));
}

/**
 * 校验广告发分奖励入参
 */
function buildAdRewardValidatorChain(): ValidatorChain<AdRewardReq> {
  return new ValidatorChain<AdRewardReq>().add(new RequiredFieldsValidator(["adToken"]));
}

/**
 * 执行数据库绑定邀请的原子操作事务
 */
async function executeBindInvite(
  db: D1Database,
  user: UserRow,
  inviterId: string,
  inviterCredits: number
): Promise<void> {
  const drizzleDb = drizzle(db);
  const now = new Date().toISOString();
  const myNewBalance = user.credits + INVITE_REWARD;
  const inviterNewBalance = inviterCredits + INVITE_REWARD;

  await drizzleDb.batch([
    drizzleDb
      .update(users)
      .set({ invitedBy: inviterId, credits: sql`credits + ${INVITE_REWARD}`, updatedAt: now })
      .where(and(eq(users.id, user.id), sql`invited_by IS NULL`)),
    drizzleDb.insert(userInvitations).values({
      inviterId,
      inviteeId: user.id,
      bonusGiven: INVITE_REWARD,
      createdAt: now
    }),
    drizzleDb.insert(creditsLedger).values({
      userId: user.id,
      delta: INVITE_REWARD,
      balance: myNewBalance,
      reason: "INVITE_BONUS",
      refId: inviterId,
      createdAt: now
    }),
    drizzleDb
      .update(users)
      .set({ credits: sql`credits + ${INVITE_REWARD}`, updatedAt: now })
      .where(eq(users.id, inviterId)),
    drizzleDb.insert(creditsLedger).values({
      userId: inviterId,
      delta: INVITE_REWARD,
      balance: inviterNewBalance,
      reason: "INVITE_BONUS",
      refId: user.id,
      createdAt: now
    })
  ]);
}

/**
 * 绑定邀请关系接口 (POST /credits/bind-invite)
 */
export async function handleBindInvite(
  request: Request,
  db: D1Database,
  user: UserRow,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as BindInviteReq;
    const validationError = buildBindInviteValidatorChain().validate(body);
    if (validationError) return ApiRes.badRequest(validationError, traceId);

    const { inviterId } = body;
    if (inviterId === user.id) return ApiRes.badRequest("不能邀请自己哦", traceId);
    if (user.invited_by) return ApiRes.badRequest("已绑定过邀请人", traceId);

    const drizzleDb = drizzle(db);
    const inviterResult = await drizzleDb.select({ id: users.id, credits: users.credits }).from(users).where(eq(users.id, inviterId));
    if (!inviterResult || inviterResult.length === 0) return ApiRes.badRequest("邀请码无效，请检查邀请码后重试", traceId);

    const actualInviterId = inviterResult[0].id;
    await executeBindInvite(db, user, actualInviterId, inviterResult[0].credits);
    TraceLogger.info("GATEWAY", "BIND_INVITE_SUCCESS", traceId, `邀请关系绑定成功`, user.id, { inviterId: actualInviterId });
    
    return ApiRes.success({ success: true }, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "BIND_INVITE_FAILED", traceId, `绑定邀请失败`, error, user.id);
    if (error.message && error.message.includes("UNIQUE constraint")) {
      return ApiRes.conflict("邀请关系已被绑定，请勿重复操作", traceId, );
    }
    return ApiRes.internalError("系统绑定邀请异常，请稍后再试", traceId);
  }
}

/**
 * 执行数据库激励广告加积分的原子操作事务
 */
async function executeAdReward(db: D1Database, user: UserRow, tokenHash: string, newBalance: number): Promise<void> {
  const drizzleDb = drizzle(db);
  const now = new Date().toISOString();
  await drizzleDb.batch([
    drizzleDb.insert(adRewardLogs).values({
      userId: user.id,
      adTokenHash: tokenHash,
      creditsAdded: AD_REWARD,
      createdAt: now
    }),
    drizzleDb
      .update(users)
      .set({ credits: sql`credits + ${AD_REWARD}`, updatedAt: now })
      .where(eq(users.id, user.id)),
    drizzleDb.insert(creditsLedger).values({
      userId: user.id,
      delta: AD_REWARD,
      balance: newBalance,
      reason: "AD_REWARD",
      refId: tokenHash,
      createdAt: now
    })
  ]);
}

/**
 * 观看广告赚积分接口 (POST /credits/reward)
 */
export async function handleAdReward(
  request: Request,
  db: D1Database,
  user: UserRow,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as AdRewardReq;
    const validationError = buildAdRewardValidatorChain().validate(body);
    if (validationError) return ApiRes.badRequest(validationError, traceId);

    const { adToken } = body;
    const tokenHash = await sha256(adToken);
    const drizzleDb = drizzle(db);
    const exists = await drizzleDb.select({ id: adRewardLogs.id }).from(adRewardLogs).where(eq(adRewardLogs.adTokenHash, tokenHash));
    if (exists && exists.length > 0) return ApiRes.conflict("广告奖励已被领取过，请勿重复领取", traceId, );

    const newBalance = user.credits + AD_REWARD;
    await executeAdReward(db, user, tokenHash, newBalance);
    TraceLogger.info("GATEWAY", "AD_REWARD_SUCCESS", traceId, `广告激励发分成功`, user.id, { addedCredits: AD_REWARD, newBalance });

    return ApiRes.success({ addedCredits: AD_REWARD, newBalance }, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "AD_REWARD_FAILED", traceId, `广告发分失败`, error, user.id);
    return ApiRes.internalError("系统领取广告奖励异常，请稍后再试", traceId);
  }
}

/**
 * 积分流水账本历史 (GET /credits/history)
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
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const drizzleDb = drizzle(db);
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

    return ApiRes.success(results, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "CREDITS_HISTORY_FAILED", traceId, `查询流水失败`, error, userId);
    return ApiRes.internalError("系统查询积分记录异常", traceId);
  }
}
