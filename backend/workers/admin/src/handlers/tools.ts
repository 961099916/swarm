// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/handlers/tools.ts

import { tools } from "@swarm/shared";
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
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 获取动态工具列表失败: ${error.message}`);
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
    
    // 检查是否重名
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
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 新增动态工具失败: ${error.message}`);
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
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 修改动态工具失败: ${error.message}`);
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
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 删除动态工具失败: ${error.message}`);
    return jsonError("系统删除动态工具异常", 500, traceId);
  }
}

export async function handleAdminDebugTool(
  adminId: string,
  request: Request,
  traceId: string
): Promise<Response> {
  try {
    const { script, input } = await request.json() as { script: string; input: any };
    if (!script?.trim()) return jsonError("测试脚本不能为空", 400, traceId);

    const startTime = Date.now();
    
    // 安全沙箱过滤
    const safeEnv = {};

    const runContext = {
      traceId,
      env: safeEnv
    };

    // 编译并运行
    const runFn = new Function("input", "context", `
      ${script}
      if (typeof run !== 'function') {
        throw new Error("调试失败：代码中未定义 async function run(input, context)");
      }
      return run(input, context);
    `);

    const executionPromise = runFn(input, runContext);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("沙箱执行超时(15秒)")), 15000)
    );

    const result = await Promise.race([executionPromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    return jsonSuccess({
      result: typeof result === "string" ? result : JSON.stringify(result),
      durationMs
    }, traceId);
  } catch (e: any) {
    let errorMsg = e.message || String(e);
    if (errorMsg.includes("disallowed for this context") || errorMsg.includes("EvalError") || errorMsg.includes("unsafe-eval")) {
      errorMsg = `[Cloudflare 安全隔离限制] 当前后端运行在 Cloudflare Workers 边缘计算节点，平台为了防范恶意代码注入，从安全机制底层禁用了运行时 JS 动态代码生成 (new Function)。请在此页面顶部切换为【API 代理模式】（No-Code 模式）进行工具声明式维护，或在本地开发环境（wrangler dev）下运行本沙箱以执行 FaaS JS 脚本调试。`;
    } else {
      errorMsg = `[EXECUTION_ERROR]: ${errorMsg}`;
    }
    return jsonSuccess({
      error: errorMsg
    }, traceId);
  }
}
