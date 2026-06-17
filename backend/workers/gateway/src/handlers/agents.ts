
import { AgentDTO, CreateAgentReq, UpdateAgentReq, AI_MODELS } from "@swarm/shared";
import { ResponseBuilder } from "../utils/response";
import {
  RequiredFieldsValidator,
  ModelWhitelistValidator,
  ToolsSecurityValidator,
  ValidatorChain
} from "../utils/validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, or, isNull, desc, and } from "drizzle-orm";
import { agents } from "@swarm/shared";

const DEFAULT_MODEL = AI_MODELS.DEFAULT;

/**
 * 格式化 Drizzle 实体对象为前端传输 DTO
 */
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
 * 查询可用的智能体列表 (GET /agents/list)
 */
export async function handleListAgents(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const drizzleDb = drizzle(db);
    const results = await drizzleDb
      .select()
      .from(agents)
      .where(or(isNull(agents.userId), eq(agents.userId, userId)))
      .orderBy(desc(agents.isPreset), desc(agents.createdAt));

    const dtoList = (results || []).map(mapAgentToDTO);
    return ResponseBuilder.success(dtoList, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 获取智能体列表异常: ${error.message || error}`);
    return ResponseBuilder.internalError("系统查询智能体列表失败", traceId);
  }
}

/**
 * 创建自定义智能体验证职责链
 */
function buildCreateValidatorChain(): ValidatorChain<CreateAgentReq> {
  return new ValidatorChain<CreateAgentReq>()
    .add(new RequiredFieldsValidator(["name", "role", "systemPrompt"]))
    .add(new ModelWhitelistValidator())
    .add(new ToolsSecurityValidator());
}

/**
 * 执行数据库插入智能体
 */
async function executeInsertAgent(db: D1Database, agentId: string, userId: string, body: CreateAgentReq): Promise<void> {
  const drizzleDb = drizzle(db);
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
 * 创建自定义智能体 (POST /agents/create)
 */
export async function handleCreateAgent(
  request: Request,
  db: D1Database,
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

    return ResponseBuilder.success({ agentId }, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 创建自定义智能体异常: ${error.message || error}`);
    return ResponseBuilder.internalError("系统部署自定义智能体失败", traceId);
  }
}

/**
 * 更新自定义智能体验证职责链
 */
function buildUpdateValidatorChain(): ValidatorChain<UpdateAgentReq> {
  return new ValidatorChain<UpdateAgentReq>()
    .add(new RequiredFieldsValidator(["agentId", "name", "role", "systemPrompt"]))
    .add(new ModelWhitelistValidator())
    .add(new ToolsSecurityValidator());
}

/**
 * 执行数据库更新智能体
 */
async function executeUpdateAgent(db: D1Database, userId: string, body: UpdateAgentReq): Promise<number> {
  const drizzleDb = drizzle(db);
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
    .where(and(eq(agents.id, body.agentId), eq(agents.userId, userId), eq(agents.isPreset, 0)))
    .run();
  return result.meta.changes;
}

/**
 * 更新自定义智能体 (PUT /agents/update)
 */
export async function handleUpdateAgent(
  request: Request,
  db: D1Database,
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

    return ResponseBuilder.success({ agentId: body.agentId }, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 修改智能体异常: ${error.message || error}`);
    return ResponseBuilder.internalError("修改自定义智能体失败", traceId);
  }
}

/**
 * 下线并删除自定义智能体 (DELETE /agents/delete)
 */
export async function handleDeleteAgent(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");

    if (!agentId) {
      return ResponseBuilder.badRequest("缺少待删除的 agentId 参数", traceId);
    }

    const drizzleDb = drizzle(db);
    const result = await drizzleDb
      .delete(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userId), eq(agents.isPreset, 0)))
      .run();

    if (!result.meta.changes) {
      return ResponseBuilder.forbidden("智能体不存在或您无权删除此内置智能体", traceId);
    }

    return ResponseBuilder.success({ success: true }, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 删除智能体异常: ${error.message || error}`);
    return ResponseBuilder.internalError("下线自定义智能体失败", traceId);
  }
}
