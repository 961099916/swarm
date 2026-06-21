// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/services/agent.service.ts

import { AgentDTO, CreateAgentReq, UpdateAgentReq, agents } from "@swarm/agent";
import { CacheService, TraceLogger } from "@swarm/kernel";
import { AgentRepository } from "../repositories/agent.repository";
import { AgentConstants } from "../constants/agent.constant";

/**
 * 智能体业务逻辑处理服务
 */
export class AgentService {
  constructor(private agentRepo: AgentRepository) {}

  /**
   * 获取用户的智能体列表 (系统预置 + 自定义)
   * 优先从 KV 缓存中获取
   */
  public async listAgents(
    kv: KVNamespace,
    userId: string,
    traceId: string
  ): Promise<AgentDTO[]> {
    const cacheKey = `${AgentConstants.CACHE_KEY_PREFIX}${userId}`;

    // 1. 尝试从缓存获取
    const cachedList = await CacheService.get<AgentDTO[]>(kv, cacheKey);
    if (cachedList !== undefined) {
      TraceLogger.debug("ENGINE", "CACHE_HIT", traceId, `智能体列表命中缓存: userId=${userId}`, userId);
      return cachedList || [];
    }

    TraceLogger.debug("ENGINE", "CACHE_MISS", traceId, `智能体列表缓存未命中，开始查库: userId=${userId}`, userId);

    // 2. 查库并映射为 DTO
    const results = await this.agentRepo.listAgents(userId);
    const dtoList = results.map(row => this.mapAgentToDTO(row));

    // 3. 异步更新缓存 (TTL: 2 小时)
    await CacheService.set(kv, cacheKey, dtoList, AgentConstants.LIST_CACHE_TTL);

    return dtoList;
  }

  /**
   * 创建自定义智能体
   */
  public async createAgent(
    kv: KVNamespace,
    userId: string,
    body: CreateAgentReq,
    traceId: string
  ): Promise<string> {
    const agentId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.agentRepo.createAgent({
      id: agentId,
      userId,
      name: body.name,
      avatar: body.avatar,
      role: body.role,
      systemPrompt: body.systemPrompt,
      model: body.model,
      tools: body.tools,
      now
    });

    // 清除该用户的缓存
    await CacheService.delete(kv, `${AgentConstants.CACHE_KEY_PREFIX}${userId}`);
    TraceLogger.info("ENGINE", "CREATE_AGENT_SUCCESS", traceId, `智能体创建成功: agentId=${agentId}`, userId);

    return agentId;
  }

  /**
   * 更新自定义智能体
   */
  public async updateAgent(
    kv: KVNamespace,
    userId: string,
    body: UpdateAgentReq,
    traceId: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const changes = await this.agentRepo.updateAgent(userId, body.id, {
      name: body.name,
      avatar: body.avatar,
      role: body.role,
      systemPrompt: body.systemPrompt,
      model: body.model,
      tools: body.tools,
      now
    });

    if (!changes) {
      throw new Error("AGENT_NOT_FOUND_OR_FORBIDDEN");
    }

    // 清除该用户的缓存
    await CacheService.delete(kv, `${AgentConstants.CACHE_KEY_PREFIX}${userId}`);
    TraceLogger.info("ENGINE", "UPDATE_AGENT_SUCCESS", traceId, `智能体更新成功: agentId=${body.id}`, userId);
  }

  /**
   * 删除自定义智能体
   */
  public async deleteAgent(
    kv: KVNamespace,
    userId: string,
    agentId: string,
    traceId: string
  ): Promise<void> {
    const changes = await this.agentRepo.deleteAgent(agentId, userId);

    if (!changes) {
      throw new Error("AGENT_NOT_FOUND_OR_FORBIDDEN");
    }

    // 清除该用户的缓存
    await CacheService.delete(kv, `${AgentConstants.CACHE_KEY_PREFIX}${userId}`);
    TraceLogger.info("ENGINE", "DELETE_AGENT_SUCCESS", traceId, `智能体删除成功: agentId=${agentId}`, userId);
  }

  /**
   * 映射数据库行到 DTO (剔除 userId)
   */
  private mapAgentToDTO(agent: typeof agents.$inferSelect): AgentDTO {
    return {
      id: agent.id,
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
}
