import { AI_MODELS, AgentDTO, CreateAgentReq, UpdateAgentReq, agents } from "@swarm/agent";
import { CacheService, TraceLogger } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/handlers/agents.ts

import { getDrizzleDb } from "../utils/drizzleInstance";
import { ResponseBuilder } from "../utils/response";
import {
  RequiredFieldsValidator,
  ModelWhitelistValidator,
  ToolsSecurityValidator,
  ValidatorChain
} from "../utils/validator";
import { eq, or, isNull, desc, and } from "drizzle-orm";

const DEFAULT_MODEL = AI_MODELS.DEFAULT;

function mapAgentToDTO(agent: typeof agents.$inferSelect): AgentDTO {
  return {
    id: agent.id,
    userId: agent.userId,
    name: agent.name,
    avatar: agent.avatar,
    role: agent.role,
    systemPrompt: agent.systemPrompt,
    model: agent.model,
    tools: agent.tools ? JSON.parse(agent.tools) : [],
    isPreset: agent.isPreset === 1,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  };
}

/**
 * 查询可用的智能体列表 (GET /api/v1/agents/list)
 * 优先命中 KV 缓存，大幅降低 D1 只读并发压力
 */
export async function handleListAgents(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const cacheKey = `user:agents:list:${userId}`;
    
    // 1. 优先读取 KV 缓存
    const cachedList = await CacheService.get<AgentDTO[]>(kv, cacheKey);
    if (cachedList !== undefined) {
      TraceLogger.debug("ENGINE", "CACHE_HIT", traceId, `智能体列表命中缓存: userId=${userId}`, userId);
      return ResponseBuilder.success(cachedList, traceId);
    }

    TraceLogger.debug("ENGINE", "CACHE_MISS", traceId, `智能体列表未命中缓存，回源 D1 查询: userId=${userId}`, userId);

    // 2. 回源查数据库
    const drizzleDb = getDrizzleDb(db);
    const results = await drizzleDb
      .select()
      .from(agents)
      .where(or(isNull(agents.userId), eq(agents.userId, userId)))
      .orderBy(desc(agents.isPreset), desc(agents.createdAt));

    const dtoList = (results || []).map(mapAgentToDTO);

    // 3. 异步回写 KV 缓存 (TTL: 2 小时)
    await CacheService.set(kv, cacheKey, dtoList, 7200);

    return ResponseBuilder.success(dtoList, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ENGINE", "LIST_AGENTS_FAILED", traceId, `获取智能体列表异常: getErrorMessage(error)`, error, userId);
    return ResponseBuilder.internalError("系统查询智能体列表失败", traceId);
  }
}

function buildCreateValidatorChain(): ValidatorChain<CreateAgentReq> {
  return new ValidatorChain<CreateAgentReq>()
    .add(new RequiredFieldsValidator(["name", "role", "systemPrompt"]))
    .add(new ModelWhitelistValidator())
    .add(new ToolsSecurityValidator());
}

async function executeInsertAgent(db: D1Database, agentId: string, userId: string, body: CreateAgentReq): Promise<void> {
  const drizzleDb = getDrizzleDb(db);
  const now = new Date().toISOString();
  const toolsStr = JSON.stringify(body.tools || []);
  await drizzleDb.insert(agents).values({
    id: agentId,
    userId,
    name: body.name.trim(),
    avatar: body.avatar?.trim() || "user",
    role: body.role.trim(),
    systemPrompt: body.systemPrompt.trim(),
    model: body.model?.trim() || DEFAULT_MODEL,
    tools: toolsStr,
    isPreset: 0,
    createdAt: now,
    updatedAt: now
  });
}

/**
 * 创建自定义智能体 (POST /api/v1/agents/create)
 */
export async function handleCreateAgent(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as CreateAgentReq;
    const validationError = buildCreateValidatorChain().validate(body);
    
    if (validationError) {
      return ResponseBuilder.badRequest(validationError, traceId);
    }

    const agentId = crypto.randomUUID();
    await executeInsertAgent(db, agentId, userId, body);

    // 缓存失效：清空该用户的智能体列表缓存，保证下次获取拿到最新列表
    await CacheService.delete(kv, `user:agents:list:${userId}`);

    TraceLogger.info("ENGINE", "CREATE_AGENT_SUCCESS", traceId, `创建自定义智能体成功: agentId=${agentId}`, userId);
    return ResponseBuilder.success({ agentId }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ENGINE", "CREATE_AGENT_FAILED", traceId, `创建自定义智能体失败: getErrorMessage(error)`, error, userId);
    return ResponseBuilder.internalError("系统部署自定义智能体失败", traceId);
  }
}

function buildUpdateValidatorChain(): ValidatorChain<UpdateAgentReq> {
  return new ValidatorChain<UpdateAgentReq>()
    .add(new RequiredFieldsValidator(["agentId", "name", "role", "systemPrompt"]))
    .add(new ModelWhitelistValidator())
    .add(new ToolsSecurityValidator());
}

async function executeUpdateAgent(db: D1Database, userId: string, body: UpdateAgentReq): Promise<number> {
  const drizzleDb = getDrizzleDb(db);
  const now = new Date().toISOString();
  const toolsStr = JSON.stringify(body.tools || []);
  const result = await drizzleDb
    .update(agents)
    .set({
      name: body.name.trim(),
      avatar: body.avatar?.trim() || "user",
      role: body.role.trim(),
      systemPrompt: body.systemPrompt.trim(),
      model: body.model?.trim() || DEFAULT_MODEL,
      tools: toolsStr,
      updatedAt: now
    })
    .where(and(eq(agents.id, body.agentId), eq(agents.userId, userId), eq(agents.isPreset, 0)));
  
  return result.meta.changes;
}

/**
 * 更新自定义智能体 (PUT /api/v1/agents/update)
 */
export async function handleUpdateAgent(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as UpdateAgentReq;
    const validationError = buildUpdateValidatorChain().validate(body);

    if (validationError) {
      return ResponseBuilder.badRequest(validationError, traceId);
    }

    const changes = await executeUpdateAgent(db, userId, body);
    if (!changes) {
      return ResponseBuilder.forbidden("智能体不存在或您无权修改此内置智能体", traceId);
    }

    // 缓存失效：清空该用户的智能体列表缓存
    await CacheService.delete(kv, `user:agents:list:${userId}`);

    TraceLogger.info("ENGINE", "UPDATE_AGENT_SUCCESS", traceId, `更新智能体成功: agentId=${body.agentId}`, userId);
    return ResponseBuilder.success({ agentId: body.agentId }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ENGINE", "UPDATE_AGENT_FAILED", traceId, `更新智能体失败: getErrorMessage(error)`, error, userId);
    return ResponseBuilder.internalError("修改自定义智能体失败", traceId);
  }
}

/**
 * 删除自定义智能体 (DELETE /api/v1/agents/delete)
 */
export async function handleDeleteAgent(
  request: Request,
  db: D1Database,
  kv: KVNamespace,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");

    if (!agentId) {
      return ResponseBuilder.badRequest("缺少待删除的 agentId 参数", traceId);
    }

    const drizzleDb = getDrizzleDb(db);
    const result = await drizzleDb
      .delete(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userId), eq(agents.isPreset, 0)));

    if (!result.meta.changes) {
      return ResponseBuilder.forbidden("智能体不存在或您无权删除此内置智能体", traceId);
    }

    // 缓存失效：清空该用户的智能体列表缓存
    await CacheService.delete(kv, `user:agents:list:${userId}`);

    TraceLogger.info("ENGINE", "DELETE_AGENT_SUCCESS", traceId, `删除智能体成功: agentId=${agentId}`, userId);
    return ResponseBuilder.success({ success: true }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("ENGINE", "DELETE_AGENT_FAILED", traceId, `删除智能体失败: getErrorMessage(error)`, error, userId);
    return ResponseBuilder.internalError("下线自定义智能体失败", traceId);
  }
}
