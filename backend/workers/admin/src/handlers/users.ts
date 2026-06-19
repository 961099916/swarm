
import { creditsLedger } from "@swarm/credits";
import { AdjustCreditsReq, BanUserReq, UpdateRoleReq, users } from "@swarm/identity";
import { CacheService, TraceLogger } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/handlers/users.ts

import { DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { eq, and, or, like, desc, sql } from "drizzle-orm";
import { jsonSuccess, jsonError } from "./responseHelper";
import { appendAuditLog } from "./audit";

export async function handleAdminUsers(
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const role = url.searchParams.get("role") || "ALL";
    const status = url.searchParams.get("status") || "ALL";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const drizzleDb = drizzle(db);
    const conditions = buildUserFilterConditions(search, role, status);
    const results = await drizzleDb
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return jsonSuccess(results, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "GET_USERS_FAILED", traceId, `获取用户列表失败: getErrorMessage(error)`, error);
    return jsonError("系统查询用户列表异常", 500, traceId);
  }
}

function buildUserFilterConditions(search: string, role: string, status: string): any[] {
  const conditions: any[] = [];
  if (search) {
    conditions.push(or(like(users.nickname, `%${search}%`), like(users.wxOpenId, `%${search}%`), eq(users.id, search)));
  }
  if (role !== "ALL") {
    conditions.push(eq(users.role, role));
  }
  if (status === "BANNED") {
    conditions.push(eq(users.isBanned, 1));
  } else if (status === "NORMAL") {
    conditions.push(eq(users.isBanned, 0));
  }
  return conditions;
}

export async function handleUpdateUserRole(
  adminId: string,
  userId: string,
  request: Request,
  db: D1Database,
  kv: any,
  traceId: string
): Promise<Response> {
  try {
    const { role } = (await request.json()) as UpdateRoleReq;
    if (role !== "FREE_USER" && role !== "VIP" && role !== "ADMIN") {
      return jsonError("非法的用户角色类型", 400, traceId);
    }

    const drizzleDb = drizzle(db);
    const result = await drizzleDb
      .update(users)
      .set({ role, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    if (result.meta.changes === 0) {
      return jsonError("目标用户不存在，修改失败", 404, traceId);
    }

    // 同步废弃网关的鉴权缓存，防止由于 KV 缓存未失效而出现安全延迟漏洞
    await CacheService.delete(kv, "user:auth:" + userId);

    await appendAuditLog(db, adminId, "UPDATE_ROLE", userId, { newRole: role });
    TraceLogger.info("ADMIN", "UPDATE_ROLE_SUCCESS", traceId, `管理员修改用户角色成功: userId=${userId}, newRole=${role}`, adminId);
    return jsonSuccess(null, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "UPDATE_ROLE_FAILED", traceId, `修改用户角色失败: userId=${userId}, error=getErrorMessage(error)`, error, adminId);
    return jsonError("系统修改角色异常", 500, traceId);
  }
}

export async function handleAdjustUserCredits(
  adminId: string,
  userId: string,
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const { delta, reason } = (await request.json()) as AdjustCreditsReq;
    if (delta === 0) {
      return jsonError("请输入有效的调整数量", 400, traceId);
    }
    const drizzleDb = drizzle(db);
    const currentCredits = await fetchUserCredits(drizzleDb, userId);
    if (currentCredits === null) {
      return jsonError("目标用户不存在", 404, traceId);
    }
    const newBalance = currentCredits + delta;
    if (newBalance < 0) {
      return jsonError("调整后积分不能为负数", 400, traceId);
    }
    await executeCreditsAdjustment(drizzleDb, userId, delta, newBalance, reason);
    await appendAuditLog(db, adminId, "ADJUST_CREDITS", userId, { delta, newBalance, reason });
    TraceLogger.info("ADMIN", "ADJUST_CREDITS_SUCCESS", traceId, `管理员调整用户积分成功: userId=${userId}, delta=${delta}, newBalance=${newBalance}`, adminId);
    return jsonSuccess({ newBalance }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "ADJUST_CREDITS_FAILED", traceId, `调整积分失败: userId=${userId}, error=getErrorMessage(error)`, error, adminId);
    return jsonError("系统调整积分异常", 500, traceId);
  }
}

async function fetchUserCredits(drizzleDb: DrizzleD1Database, userId: string): Promise<number | null> {
  const res = await drizzleDb.select({ credits: users.credits }).from(users).where(eq(users.id, userId));
  return res.length > 0 ? res[0].credits : null;
}

async function executeCreditsAdjustment(
  drizzleDb: DrizzleD1Database,
  userId: string,
  delta: number,
  balance: number,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  await drizzleDb.batch([
    drizzleDb.update(users).set({ credits: sql`credits + ${delta}`, updatedAt: now }).where(eq(users.id, userId)),
    drizzleDb.insert(creditsLedger).values({
      userId,
      delta,
      balance,
      reason: "ADMIN_ADJUST",
      refId: reason || "管理员后台调整",
      createdAt: now
    })
  ]);
}

export async function handleInvalidateUserToken(
  adminId: string,
  userId: string,
  db: D1Database,
  kv: any,
  traceId: string
): Promise<Response> {
  try {
    const drizzleDb = drizzle(db);
    const result = await drizzleDb
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    if (result.meta.changes === 0) {
      return jsonError("用户不存在", 404, traceId);
    }

    // 同步废弃网关的鉴权缓存，防止封禁/下线状态由于 KV 缓存未失效而出现安全延迟漏洞
    await CacheService.delete(kv, "user:auth:" + userId);

    await appendAuditLog(db, adminId, "INVALIDATE_TOKEN", userId, null);
    TraceLogger.info("ADMIN", "INVALIDATE_TOKEN_SUCCESS", traceId, `管理员强制用户下线成功: userId=${userId}`, adminId);
    return jsonSuccess(null, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "INVALIDATE_TOKEN_FAILED", traceId, `强制下线失败: userId=${userId}, error=getErrorMessage(error)`, error, adminId);
    return jsonError("系统下线操作异常", 500, traceId);
  }
}

export async function handleBanUser(
  adminId: string,
  userId: string,
  request: Request,
  db: D1Database,
  kv: any,
  traceId: string
): Promise<Response> {
  try {
    const { isBanned, reason } = (await request.json()) as BanUserReq;
    const bannedReasonVal = isBanned ? reason || "违反服务条款" : null;

    const drizzleDb = drizzle(db);
    const result = await drizzleDb
      .update(users)
      .set({
        isBanned: isBanned ? 1 : 0,
        bannedReason: bannedReasonVal,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: new Date().toISOString()
      })
      .where(eq(users.id, userId));

    if (result.meta.changes === 0) {
      return jsonError("目标用户不存在", 404, traceId);
    }

    // 同步废弃网关的鉴权缓存，防止封禁/下线状态由于 KV 缓存未失效而出现安全延迟漏洞
    await CacheService.delete(kv, "user:auth:" + userId);

    await appendAuditLog(db, adminId, isBanned ? "BAN_USER" : "UNBAN_USER", userId, { reason: bannedReasonVal });
    TraceLogger.info("ADMIN", isBanned ? "BAN_USER_SUCCESS" : "UNBAN_USER_SUCCESS", traceId, `管理员设置封禁状态成功: userId=${userId}, isBanned=${isBanned}`, adminId);
    return jsonSuccess(null, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "BAN_USER_FAILED", traceId, `用户封禁控制操作失败: userId=${userId}, error=getErrorMessage(error)`, error, adminId);
    return jsonError("系统更新账号封禁状态异常", 500, traceId);
  }
}
