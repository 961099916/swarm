
import { agents } from "@swarm/shared";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import { jsonSuccess, jsonError } from "./responseHelper";
import { appendAuditLog } from "./audit";

export async function handleAdminListAgents(
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const drizzleDb = drizzle(db);
    const results = await drizzleDb
      .select()
      .from(agents)
      .orderBy(desc(agents.isPreset), desc(agents.createdAt))
      .limit(limit)
      .offset(offset);
    
    const parsedList = results.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      avatar: row.avatar,
      role: row.role,
      systemPrompt: row.systemPrompt,
      model: row.model,
      tools: row.tools ? JSON.parse(row.tools) : [],
      isPreset: row.isPreset === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));

    return jsonSuccess(parsedList, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 获取智能体列表失败: ${error.message}`);
    return jsonError("系统查询全局智能体异常", 500, traceId);
  }
}

export async function handleAdminUpdateAgent(
  adminId: string,
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { agentId, name, avatar, role, systemPrompt, model, tools } = body;

    if (!agentId) return jsonError("缺少待修改的 agentId", 400, traceId);
    if (!name?.trim()) return jsonError("智能体名称不能为空", 400, traceId);

    const drizzleDb = drizzle(db);
    const result = await drizzleDb
      .update(agents)
      .set({
        name: name.trim(),
        avatar: avatar?.trim() || "user",
        role: role.trim(),
        systemPrompt: systemPrompt.trim(),
        model: model?.trim() || "",
        tools: JSON.stringify(tools || []),
        updatedAt: new Date().toISOString()
      })
      .where(eq(agents.id, agentId));

    if (!result.meta.changes) return jsonError("智能体不存在，修改失败", 404, traceId);

    await appendAuditLog(db, adminId, "UPDATE_AGENT", agentId, { name, role });
    return jsonSuccess({ agentId }, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 修改智能体失败: ${error.message}`);
    return jsonError("系统修改智能体异常", 500, traceId);
  }
}

export async function handleAdminDeleteAgent(
  adminId: string,
  request: Request,
  db: D1Database,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");
    if (!agentId) return jsonError("缺少待下线的 agentId 参数", 400, traceId);

    const drizzleDb = drizzle(db);
    const result = await drizzleDb
      .delete(agents)
      .where(and(eq(agents.id, agentId), eq(agents.isPreset, 0)));

    if (!result.meta.changes) {
      return jsonError("智能体不存在或为内置预设智能体，禁止删除", 403, traceId);
    }

    await appendAuditLog(db, adminId, "DELETE_AGENT", agentId, null);
    return jsonSuccess({ success: true }, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 下线智能体失败: ${error.message}`);
    return jsonError("系统下线智能体异常", 500, traceId);
  }
}
