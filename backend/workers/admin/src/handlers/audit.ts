
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import { jsonSuccess, jsonError } from "./responseHelper";

import { adminAuditLogs } from "@swarm/agent";
import { TraceLogger } from "@swarm/kernel";

export async function appendAuditLog(
  db: D1Database,
  adminId: string,
  action: string,
  targetId: string,
  detail: Record<string, any> | null
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const drizzleDb = drizzle(db);
    await drizzleDb.insert(adminAuditLogs).values({
      adminId,
      action,
      targetId,
      detail: detail ? JSON.stringify(detail) : null,
      createdAt: now
    });
  } catch (err: unknown) {
    TraceLogger.error("ADMIN", "AUDIT_LOG_WRITE_FAILED", "SYSTEM", `写入审计日志失败: action=${action}, target=${targetId}`, err);
  }
}

export async function handleAdminListAuditLogs(
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "";
    const targetId = url.searchParams.get("targetId") || "";
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const drizzleDb = drizzle(db);
    const conditions: any[] = [];
    if (action) {
      conditions.push(eq(adminAuditLogs.action, action));
    }
    if (targetId) {
      conditions.push(eq(adminAuditLogs.targetId, targetId));
    }

    const results = await drizzleDb
      .select()
      .from(adminAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const parsedList = results.map((row) => ({
      id: row.id,
      adminId: row.adminId,
      action: row.action,
      targetId: row.targetId,
      detail: row.detail ? JSON.parse(row.detail) : null,
      createdAt: row.createdAt
    }));

    return jsonSuccess(parsedList, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "LIST_AUDIT_FAILED", traceId, `获取审计日志列表异常: getErrorMessage(error)`, error);
    return jsonError("系统查询审计日志异常", 500, traceId);
  }
}
