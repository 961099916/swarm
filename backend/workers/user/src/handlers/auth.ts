// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/handlers/auth.ts

import { 
  LoginReq, 
  LoginRes, 
  users, 
  creditsLedger, 
  userInvitations, 
  INITIAL_CREDITS, 
  INVITE_REWARD, 
  TOKEN_EXPIRY_SECONDS,
  TraceLogger,
  CacheService,
  UserRow
} from "@swarm/shared";
import { signJWT } from "../utils/jwtHelper";
import { getDrizzleDb } from "../utils/drizzleInstance";
import { ResponseBuilder } from "../utils/response";
import { RequiredFieldsValidator, ValidatorChain } from "../utils/validator";
import { eq, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";

interface WxSessionResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

function buildLoginValidatorChain(): ValidatorChain<LoginReq> {
  return new ValidatorChain<LoginReq>().add(new RequiredFieldsValidator(["code"]));
}

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

/**
 * 将 Drizzle 查询返回的用户行映射为 UserRow (snake_case) 类型
 */
function mapDrizzleUserToRow(row: typeof users.$inferSelect): UserRow {
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

async function registerNewUser(
  db: D1Database,
  openId: string,
  nickname: string | undefined,
  avatarUrl: string | undefined,
  inviterId: string | undefined,
  traceId: string
): Promise<UserRow> {
  const drizzleDb = getDrizzleDb(db);
  const newUserId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 1. 强一致性本地事务：注册用户并奖励初始积分
  return await drizzleDb.transaction(async (tx: DrizzleD1Database) => {
    // 校验邀请人是否存在
    let invitedBy: string | null = null;
    if (inviterId && inviterId !== newUserId) {
      const inviter = await tx
        .select({ id: users.id, credits: users.credits })
        .from(users)
        .where(eq(users.id, inviterId));
      if (inviter && inviter.length > 0) {
        invitedBy = inviter[0].id;
      }
    }

    const finalCredits = invitedBy ? INITIAL_CREDITS + INVITE_REWARD : INITIAL_CREDITS;

    // 插入被邀请用户
    await tx.insert(users).values({
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
    });

    // 记录初始赠送积分流水
    await tx.insert(creditsLedger).values({
      userId: newUserId,
      delta: INITIAL_CREDITS,
      balance: INITIAL_CREDITS,
      reason: "ADMIN_ADJUST",
      refId: "SYSTEM_REGISTER",
      createdAt: now,
    });

    if (invitedBy) {
      // 记录邀请奖励加分流水
      await tx.insert(creditsLedger).values({
        userId: newUserId,
        delta: INVITE_REWARD,
        balance: finalCredits,
        reason: "INVITE_BONUS",
        refId: invitedBy,
        createdAt: now,
      });

      // 插入邀请人与被邀请人关系记录
      await tx.insert(userInvitations).values({
        inviterId: invitedBy,
        inviteeId: newUserId,
        bonusGiven: INVITE_REWARD,
        createdAt: now,
      });

      // 强一致性物理事务原子更新邀请人积分
      const inviterUpdate = await tx
        .update(users)
        .set({ credits: sql`credits + ${INVITE_REWARD}`, updatedAt: now })
        .where(eq(users.id, invitedBy))
        .returning({ credits: users.credits });

      if (inviterUpdate.length > 0) {
        // 记录邀请人加积分流水
        await tx.insert(creditsLedger).values({
          userId: invitedBy,
          delta: INVITE_REWARD,
          balance: inviterUpdate[0].credits,
          reason: "INVITE_BONUS",
          refId: newUserId,
          createdAt: now,
        });
      }
    }

    // 查询并返回新创建的完整用户记录
    const newUserList = await tx.select().from(users).where(eq(users.id, newUserId));
    return mapDrizzleUserToRow(newUserList[0]);
  });
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

/**
 * 微信小程序注册/登录 (POST /api/v1/auth/login)
 */
export async function handleLogin(
  request: Request,
  db: D1Database,
  env: { JWT_SECRET: string; WX_APP_ID: string; WX_APP_SECRET: string; CACHE_KV: KVNamespace },
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as LoginReq;
    const validationError = buildLoginValidatorChain().validate(body);
    if (validationError) return ResponseBuilder.badRequest(validationError, traceId);

    const openId = await fetchWxOpenId(body.code, env.WX_APP_ID, env.WX_APP_SECRET);
    const drizzleDb = getDrizzleDb(db);
    const userResult = await drizzleDb.select().from(users).where(eq(users.wxOpenId, openId));
    
    let user: UserRow | null = userResult.length > 0 ? mapDrizzleUserToRow(userResult[0]) : null;

    if (!user) {
      user = await registerNewUser(db, openId, body.nickname, body.avatarUrl, body.inviterId, traceId);
      TraceLogger.info("USER", "USER_REGISTER", traceId, `新用户注册成功: userId=${user.id}`, user.id);
    } else {
      if (user.is_banned === 1) {
        TraceLogger.warn("USER", "LOGIN_BLOCKED", traceId, `封禁用户尝试登录被拦截: userId=${user.id}`, user.id);
        return ResponseBuilder.forbidden(
          `您的账号已被封禁。原因：${user.banned_reason || "违反服务协议"}`,
          traceId
        );
      }
    }

    // 生成 JWT
    const token = await generateUserToken(user, env.JWT_SECRET);

    // 缓存预热：将用户的最新鉴权状态写入 KV 缓存，免去网关后续 API 的查库延迟
    // 必须包含 role 字段，否则网关 authMiddleware 返回的 userRole 为 undefined → 403
    await CacheService.set(
      env.CACHE_KV,
      `user:auth:${user.id}`,
      { tokenVersion: user.token_version, isBanned: user.is_banned, role: user.role },
      3600 // 缓存 1 小时（CacheService 内部会自动注入 Jitter）
    );

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

    TraceLogger.info("USER", "USER_LOGIN", traceId, `用户登录成功: userId=${user.id}`, user.id);
    return ResponseBuilder.success(loginRes, traceId);
  } catch (error: any) {
    TraceLogger.error("USER", "USER_LOGIN_FAILED", traceId, `微信登录失败: ${error.message || error}`, error);
    return ResponseBuilder.internalError("系统登录异常，请稍后再试", traceId);
  }
}

/**
 * 退出登录 (POST /api/v1/auth/logout)
 */
export async function handleLogout(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const drizzleDb = getDrizzleDb(db);
    const now = new Date().toISOString();

    // 1. 原子递增 tokenVersion 以作废之前的 token
    await drizzleDb
      .update(users)
      .set({ tokenVersion: sql`token_version + 1`, updatedAt: now })
      .where(eq(users.id, userId));

    // 2. 缓存失效：彻底清除网关层的鉴权快照，迫使旧 Token 废弃下线
    await CacheService.delete(kv, `user:auth:${userId}`);

    TraceLogger.info("USER", "USER_LOGOUT", traceId, `用户退出登录成功，Token 已强制失效`, userId);
    return ResponseBuilder.success({ success: true }, traceId);
  } catch (error: any) {
    TraceLogger.error("USER", "USER_LOGOUT_FAILED", traceId, `用户退出登录失败: ${error.message || error}`, error, userId);
    return ResponseBuilder.internalError("系统退出登录异常", traceId);
  }
}
