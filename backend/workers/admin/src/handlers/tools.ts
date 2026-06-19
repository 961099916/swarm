import { tools } from "@swarm/agent";
import { TraceLogger } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/handlers/tools.ts

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import { jsonSuccess, jsonError } from "./responseHelper";
import { appendAuditLog } from "./audit";

export async function handleAdminListTools(
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const drizzleDb = drizzle(db);
    const results = await drizzleDb
      .select()
      .from(tools)
      .orderBy(desc(tools.createdAt));

    const parsedList = results.map((row) => ({
      name: row.name,
      description: row.description,
      category: row.category,
      endpoint: row.endpoint,
      method: row.method,
      headers: row.headers ? JSON.parse(row.headers) : {},
      bodyTemplate: row.bodyTemplate,
      script: row.script,
      paramsSchema: row.paramsSchema ? JSON.parse(row.paramsSchema) : [],
      responseSelector: row.responseSelector,
      enabled: row.enabled === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));

    return jsonSuccess(parsedList, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "LIST_TOOLS_FAILED", traceId, `获取动态工具列表失败: getErrorMessage(error)`, error);
    return jsonError("系统查询全局工具异常", 500, traceId);
  }
}

export async function handleAdminCreateTool(
  adminId: string,
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { name, description, category, endpoint, method, headers, bodyTemplate, script, paramsSchema, responseSelector } = body;

    if (!name?.trim()) return jsonError("工具标识 name 不能为空", 400, traceId);
    if (!description?.trim()) return jsonError("工具描述不能为空", 400, traceId);

    const drizzleDb = drizzle(db);
    
    const results = await drizzleDb
      .select()
      .from(tools)
      .where(eq(tools.name, name.trim()))
      .limit(1);
      
    const existing = results[0];
      
    if (existing) {
      return jsonError("该工具标识 name 已经存在", 400, traceId);
    }

    const nowStr = new Date().toISOString();
    await drizzleDb
      .insert(tools)
      .values({
        name: name.trim(),
        description: description.trim(),
        category: category?.trim() || "general",
        endpoint: endpoint?.trim() || null,
        method: method?.trim() || "GET",
        headers: JSON.stringify(headers || {}),
        bodyTemplate: bodyTemplate?.trim() || null,
        script: script?.trim() || null,
        paramsSchema: JSON.stringify(paramsSchema || []),
        responseSelector: responseSelector?.trim() || null,
        enabled: 1,
        createdAt: nowStr,
        updatedAt: nowStr
      });

    await appendAuditLog(db, adminId, "CREATE_TOOL", name.trim(), { name, category });
    return jsonSuccess({ name: name.trim() }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "CREATE_TOOL_FAILED", traceId, `新增动态工具失败: getErrorMessage(error)`, error);
    return jsonError("系统创建动态工具异常", 500, traceId);
  }
}

export async function handleAdminUpdateTool(
  adminId: string,
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { name, description, category, endpoint, method, headers, bodyTemplate, script, paramsSchema, responseSelector, enabled } = body;

    if (!name?.trim()) return jsonError("缺少待修改的工具标识 name", 400, traceId);

    const drizzleDb = drizzle(db);
    const result = await drizzleDb
      .update(tools)
      .set({
        description: description?.trim(),
        category: category?.trim(),
        endpoint: endpoint?.trim() || null,
        method: method?.trim(),
        headers: headers ? JSON.stringify(headers) : undefined,
        bodyTemplate: bodyTemplate?.trim() || null,
        script: script?.trim() || null,
        paramsSchema: paramsSchema ? JSON.stringify(paramsSchema) : undefined,
        responseSelector: responseSelector?.trim() || null,
        enabled: enabled !== undefined ? (enabled ? 1 : 0) : undefined,
        updatedAt: new Date().toISOString()
      })
      .where(eq(tools.name, name.trim()));

    if (!result.meta.changes) return jsonError("工具不存在，修改失败", 404, traceId);

    await appendAuditLog(db, adminId, "UPDATE_TOOL", name.trim(), { description, enabled });
    return jsonSuccess({ name: name.trim() }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "UPDATE_TOOL_FAILED", traceId, `修改动态工具失败: getErrorMessage(error)`, error);
    return jsonError("系统修改动态工具异常", 500, traceId);
  }
}

export async function handleAdminDeleteTool(
  adminId: string,
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");
    if (!name) return jsonError("缺少待删除的工具 name 参数", 400, traceId);

    const drizzleDb = drizzle(db);
    const result = await drizzleDb
      .delete(tools)
      .where(eq(tools.name, name));

    if (!result.meta.changes) {
      return jsonError("动态工具不存在，删除失败", 404, traceId);
    }

    await appendAuditLog(db, adminId, "DELETE_TOOL", name, null);
    return jsonSuccess(true, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ADMIN", "DELETE_TOOL_FAILED", traceId, `删除动态工具失败: getErrorMessage(error)`, error);
    return jsonError("系统删除动态工具异常", 500, traceId);
  }
}
