/**
 * AI Gateway 管理后端 API
 *
 * 提供模型配置管理、AI 调用日志查看、用量统计。
 */

import { ModelConfigDTO, AICallLogDTO, AIStatsDTO, TraceLogger } from "@swarm/shared";
import { jsonSuccess, jsonError } from "./responseHelper";

// ══════════════════════════════════════════════════
// 模型配置管理
// ══════════════════════════════════════════════════

export async function handleListModelConfigs(db: D1Database, traceId: string): Promise<Response> {
  try {
    const { results } = await db
      .prepare("SELECT * FROM model_configs ORDER BY purpose, priority DESC")
      .all<any>();

    const dtoList: ModelConfigDTO[] = (results || []).map(r => ({
      id: r.id,
      purpose: r.purpose,
      provider: r.provider,
      modelName: r.model_name,
      displayName: r.display_name || undefined,
      isDefault: r.is_default === 1,
      isActive: r.is_active === 1,
      rateLimitRpm: r.rate_limit_rpm,
      rateLimitTpm: r.rate_limit_tpm,
      costPer1kInput: r.cost_per_1k_input,
      costPer1kOutput: r.cost_per_1k_output,
      config: JSON.parse(r.config_json || "{}"),
      priority: r.priority,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return jsonSuccess(dtoList, traceId);
  } catch (err: any) {
    TraceLogger.error("ADMIN", "LIST_MODEL_FAILED", traceId, `获取模型配置列表异常: ${err.message}`, err);
    return jsonError("获取模型配置列表失败", 500, traceId);
  }
}

export async function handleUpdateModelConfig(db: D1Database, request: Request, traceId: string): Promise<Response> {
  try {
    const body = await request.json() as any;
    const modelId = body.id;
    if (!modelId) return jsonError("缺少模型配置 ID", 400, traceId);

    const now = new Date().toISOString();
    const sets: string[] = ["updated_at = ?"];
    const values: any[] = [now];

    if (body.isActive !== undefined) { sets.push("is_active = ?"); values.push(body.isActive ? 1 : 0); }
    if (body.isDefault !== undefined) { sets.push("is_default = ?"); values.push(body.isDefault ? 1 : 0); }
    if (body.rateLimitRpm !== undefined) { sets.push("rate_limit_rpm = ?"); values.push(body.rateLimitRpm); }
    if (body.rateLimitTpm !== undefined) { sets.push("rate_limit_tpm = ?"); values.push(body.rateLimitTpm); }
    if (body.costPer1kInput !== undefined) { sets.push("cost_per_1k_input = ?"); values.push(body.costPer1kInput); }
    if (body.costPer1kOutput !== undefined) { sets.push("cost_per_1k_output = ?"); values.push(body.costPer1kOutput); }
    if (body.displayName !== undefined) { sets.push("display_name = ?"); values.push(body.displayName); }

    // 如果设为默认，先清除同 purpose 的其他默认
    if (body.isDefault) {
      const config = await db.prepare("SELECT purpose FROM model_configs WHERE id = ?").bind(modelId).first<any>();
      if (config?.purpose) {
        await db.prepare("UPDATE model_configs SET is_default = 0 WHERE purpose = ?").bind(config.purpose).run();
      }
    }

    values.push(modelId);
    const result = await db
      .prepare(`UPDATE model_configs SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    if (!result.meta.changes) {
      return jsonError("模型配置不存在", 404, traceId);
    }

    TraceLogger.info("ADMIN", "UPDATE_MODEL_CONFIG", traceId, `更新模型配置: ${modelId}`);
    return jsonSuccess({ id: modelId }, traceId);
  } catch (err: any) {
    TraceLogger.error("ADMIN", "UPDATE_MODEL_FAILED", traceId, `更新模型配置异常: ${err.message}`, err);
    return jsonError("更新模型配置失败", 500, traceId);
  }
}

// ══════════════════════════════════════════════════
// AI 调用日志
// ══════════════════════════════════════════════════

export async function handleListAICallLogs(db: D1Database, request: Request, traceId: string): Promise<Response> {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const userId = url.searchParams.get("userId");
    const modelName = url.searchParams.get("modelName");
    const purpose = url.searchParams.get("purpose");
    const status = url.searchParams.get("status");
    const startTime = url.searchParams.get("startTime");
    const endTime = url.searchParams.get("endTime");

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (userId) { whereClause += " AND user_id = ?"; params.push(userId); }
    if (modelName) { whereClause += " AND model_name = ?"; params.push(modelName); }
    if (purpose) { whereClause += " AND purpose = ?"; params.push(purpose); }
    if (status) { whereClause += " AND status = ?"; params.push(status); }
    if (startTime) { whereClause += " AND created_at >= ?"; params.push(startTime); }
    if (endTime) { whereClause += " AND created_at <= ?"; params.push(endTime); }

    const offset = (page - 1) * limit;
    const { results } = await db
      .prepare(`SELECT * FROM ai_call_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset)
      .all<any>();

    const { results: countResult } = await db
      .prepare(`SELECT COUNT(*) as total FROM ai_call_logs ${whereClause}`)
      .bind(...params)
      .all<any>();

    const total = countResult?.[0]?.total || 0;

    const dtoList: AICallLogDTO[] = (results || []).map(r => ({
      id: r.id,
      traceId: r.trace_id,
      purpose: r.purpose,
      provider: r.provider,
      modelName: r.model_name,
      userId: r.user_id || undefined,
      agentId: r.agent_id || undefined,
      taskId: r.task_id || undefined,
      kbId: r.kb_id || undefined,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      latencyMs: r.latency_ms,
      status: r.status,
      errorMessage: r.error_message || undefined,
      costUsd: r.cost_usd,
      createdAt: r.created_at,
    }));

    return jsonSuccess({ logs: dtoList, total, page, limit }, traceId);
  } catch (err: any) {
    TraceLogger.error("ADMIN", "LIST_AI_LOGS_FAILED", traceId, `获取 AI 调用日志异常: ${err.message}`, err);
    return jsonError("获取 AI 调用日志失败", 500, traceId);
  }
}

// ══════════════════════════════════════════════════
// AI 用量统计
// ══════════════════════════════════════════════════

export async function handleAIStats(db: D1Database, traceId: string): Promise<Response> {
  try {
    // 全局统计
    const { results: globalStats } = await db
      .prepare(`
        SELECT
          COUNT(*) as total_calls,
          SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_calls,
          SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_calls,
          SUM(CASE WHEN status = 'RATE_LIMITED' THEN 1 ELSE 0 END) as rate_limited_calls,
          COALESCE(SUM(input_tokens), 0) as total_input_tokens,
          COALESCE(SUM(output_tokens), 0) as total_output_tokens,
          COALESCE(SUM(cost_usd), 0) as total_cost_usd,
          COALESCE(ROUND(AVG(latency_ms)), 0) as avg_latency_ms
        FROM ai_call_logs
        WHERE created_at > datetime('now', '-7 days')
      `)
      .all<any>();

    // 按模型统计
    const { results: byModel } = await db
      .prepare(`
        SELECT model_name, COUNT(*) as count, COALESCE(SUM(cost_usd), 0) as cost_usd
        FROM ai_call_logs
        WHERE created_at > datetime('now', '-7 days')
        GROUP BY model_name
        ORDER BY count DESC
      `)
      .all<any>();

    // 按小时统计
    const { results: byHour } = await db
      .prepare(`
        SELECT substr(created_at, 1, 13) as hour, COUNT(*) as count
        FROM ai_call_logs
        WHERE created_at > datetime('now', '-24 hours')
        GROUP BY hour
        ORDER BY hour
      `)
      .all<any>();

    const stats: AIStatsDTO = {
      totalCalls: globalStats?.[0]?.total_calls || 0,
      successCalls: globalStats?.[0]?.success_calls || 0,
      failedCalls: globalStats?.[0]?.failed_calls || 0,
      rateLimitedCalls: globalStats?.[0]?.rate_limited_calls || 0,
      totalInputTokens: globalStats?.[0]?.total_input_tokens || 0,
      totalOutputTokens: globalStats?.[0]?.total_output_tokens || 0,
      totalCostUsd: globalStats?.[0]?.total_cost_usd || 0,
      avgLatencyMs: globalStats?.[0]?.avg_latency_ms || 0,
      callsByModel: (byModel || []).map((r: any) => ({ modelName: r.model_name, count: r.count, costUsd: r.cost_usd })),
      callsByHour: (byHour || []).map((r: any) => ({ hour: r.hour, count: r.count })),
    };

    return jsonSuccess(stats, traceId);
  } catch (err: any) {
    TraceLogger.error("ADMIN", "AI_STATS_FAILED", traceId, `获取 AI 统计异常: ${err.message}`, err);
    return jsonError("获取 AI 统计失败", 500, traceId);
  }
}

/**
 * 获取所有知识库列表（管理后台用，不限制用户）
 */
export async function handleAdminListKBs(db: D1Database, traceId: string): Promise<Response> {
  try {
    const { results } = await db
      .prepare(`
        SELECT kb.*,
          (SELECT COUNT(*) FROM documents d WHERE d.kb_id = kb.id) as doc_count,
          u.nickname as owner_name
        FROM knowledge_bases kb
        LEFT JOIN users u ON u.id = kb.user_id
        ORDER BY kb.created_at DESC
      `)
      .all<any>();

    return jsonSuccess(results || [], traceId);
  } catch (err: any) {
    TraceLogger.error("ADMIN", "LIST_KB_FAILED", traceId, `管理后台获取知识库列表异常: ${err.message}`, err);
    return jsonError("获取知识库列表失败", 500, traceId);
  }
}
