/**
 * 认证处理模块 — 微信登录 / 登出
 *
 * 职责链说明:
 *   参数校验(RequiredFieldsValidator) → 微信 OpenID 获取 → 用户注册/登录 → JWT 签发
 *
 * @module handlers/auth
 */

import { creditsLedger, userInvitations, INITIAL_CREDITS, INVITE_REWARD } from "@swarm/credits";
import { LoginReq, LoginRes, users, TOKEN_EXPIRY_SECONDS } from "@swarm/identity";
import { TraceLogger } from "@swarm/kernel"; import type { UserRow } from "@swarm/identity";
import { signJWT } from "../jwtHelper";
import { changeUserCredits } from "../creditsHelper";
import { ApiRes, getErrorMessage } from "/kernel";
import { findFirstUser } from "../utils/drizzle";
import { RequiredFieldsValidator, ValidatorChain } from "../utils/validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";

interface WxSessionResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

// ─── 校验器构建 ───

function buildLoginValidatorChain(): ValidatorChain<LoginReq> {
  return new ValidatorChain<LoginReq>().add(new RequiredFieldsValidator(["code"]));
}

// ─── 微信 API 调用 ───

async function fetchWxOpenId(code: string, appId: string, appSecret: string): Promise<string> {
  const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
  const wxRes = await fetch(wxUrl);
  if (!wxRes.ok) {
    throw new Error(`微信接口请求失败，状态码: ${wxRes.status}`);
  }
  const wxData = (await wxRes.json()) as WxSessionResponse;
  if (wxData.errcode || !wxData.openid) {
    throw new Error(`微信登录错误: ${wxData.errmsg || "未知原因"} (错误码: ${wxData.errcode})`);
  }
  return wxData.openid;
}

// ─── 用户注册 ───

async function registerNewUser(
  db: D1Database,
  openId: string,
  nickname: string | undefined,
  avatarUrl: string | undefined,
  inviterId: string | undefined,
  traceId: string
): Promise<string> {
  const drizzleDb = drizzle(db);
  const newUserId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 校验邀请人是否存在 (使用 eq 而非 like 避免模糊匹配安全问题)
  let invitedBy: string | null = null;
  if (inviterId && inviterId !== newUserId) {
    const inviter = await drizzleDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, inviterId));
    if (inviter && inviter.length > 0) invitedBy = inviter[0].id;
  }

  const finalCredits = invitedBy ? INITIAL_CREDITS + INVITE_REWARD : INITIAL_CREDITS;

  if (invitedBy) {
    await drizzleDb.batch([
      drizzleDb.insert(users).values({
        id: newUserId,
        wxOpenId: openId,
        nickname: nickname || "微信用户",
        avatarUrl: avatarUrl || "",
        role: "FREE_USER",
        credits: finalCredits,
        tokenVersion: 1,
        isBanned: 0,
        invitedBy,
        createdAt: now,
        updatedAt: now,
      }),
      drizzleDb.insert(creditsLedger).values({
        userId: newUserId,
        delta: INITIAL_CREDITS,
        balance: INITIAL_CREDITS,
        reason: "ADMIN_ADJUST",
        createdAt: now,
      }),
      drizzleDb.insert(userInvitations).values({
        inviterId: invitedBy,
        inviteeId: newUserId,
        bonusGiven: INVITE_REWARD,
        createdAt: now,
      }),
      drizzleDb.insert(creditsLedger).values({
        userId: newUserId,
        delta: INVITE_REWARD,
        balance: finalCredits,
        reason: "INVITE_BONUS",
        createdAt: now,
      }),
    ]);
  } else {
    await drizzleDb.batch([
      drizzleDb.insert(users).values({
        id: newUserId,
        wxOpenId: openId,
        nickname: nickname || "微信用户",
        avatarUrl: avatarUrl || "",
        role: "FREE_USER",
        credits: finalCredits,
        tokenVersion: 1,
        isBanned: 0,
        invitedBy,
        createdAt: now,
        updatedAt: now,
      }),
      drizzleDb.insert(creditsLedger).values({
        userId: newUserId,
        delta: INITIAL_CREDITS,
        balance: INITIAL_CREDITS,
        reason: "ADMIN_ADJUST",
        createdAt: now,
      }),
    ]);
  }

  if (invitedBy) {
    changeUserCredits(db, invitedBy, INVITE_REWARD, "INVITE_BONUS", newUserId, traceId).catch((err) => {
      TraceLogger.warn("GATEWAY", "INVITE_CREDITS_FAILED", traceId, `注册时为邀请人 ${inviterId} 增加积分失败: getErrorMessage(err)`);
    });
  }

  return newUserId;
}

async function generateUserToken(user: UserRow, jwtSecret: string): Promise<string> {
  const expInSeconds = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
  return await signJWT(
    {
      userId: user.id,
      tokenVersion: user.token_version,
      exp: expInSeconds,
    },
    jwtSecret
  );
}

// ─── 公开处理函数 ───

export async function handleLogin(
  request: Request,
  db: D1Database,
  env: { JWT_SECRET: string; WX_APP_ID: string; WX_APP_SECRET: string },
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as LoginReq;
    const validationError = buildLoginValidatorChain().validate(body);
    if (validationError) return ApiRes.badRequest(validationError, traceId);

    const openId = await fetchWxOpenId(body.code, env.WX_APP_ID, env.WX_APP_SECRET);
    const drizzleDb = drizzle(db);
    const userResult = await drizzleDb.select().from(users).where(eq(users.wxOpenId, openId));
    let user = findFirstUser(userResult);

    if (!user) {
      const newUserId = await registerNewUser(db, openId, body.nickname, body.avatarUrl, body.inviterId, traceId);
      const newUserResult = await drizzleDb.select().from(users).where(eq(users.id, newUserId));
      user = findFirstUser(newUserResult);
    } else {
      if (user.is_banned === 1) {
        return ApiRes.forbidden(
          `您的账号已被封禁。原因：${user.banned_reason || "违反服务协议"}`,
          traceId
        );
      }
    }

    if (!user) throw new Error("用户加载异常");
    const token = await generateUserToken(user, env.JWT_SECRET);
    const loginRes: LoginRes = {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatar_url,
        role: user.role,
        credits: user.credits,
      },
    };
    return ApiRes.success(loginRes, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "LOGIN_FAILED", traceId, `登录失败: ${error instanceof Error ? error.message : String(error)}`, error);
    return ApiRes.internalError("系统登录异常，请稍后再试", traceId);
  }
}

export async function handleLogout(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const drizzleDb = drizzle(db);
    const now = new Date().toISOString();
    await drizzleDb
      .update(users)
      .set({ tokenVersion: sql`token_version + 1`, updatedAt: now })
      .where(eq(users.id, userId))
      .run();
    TraceLogger.info("GATEWAY", "LOGOUT_SUCCESS", traceId, `用户退出登录成功，已失效其 Token`, userId);
    return ApiRes.success({ success: true }, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "LOGOUT_FAILED", traceId, `登出失败: ${error instanceof Error ? error.message : String(error)}`, error);
    return ApiRes.internalError("系统退出登录异常", traceId);
  }
}
