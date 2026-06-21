// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/repositories/agent.repository.ts

import { agents, AgentConfig } from "@swarm/agent";
import { getDrizzleDb } from "../utils/drizzleInstance";
import { eq, or, isNull, desc, and } from "drizzle-orm";
import { AgentConstants } from "../constants/agent.constant";

/**
 * 智能体仓储层，收拢对 agents 数据库表的物理操作
 */
export class AgentRepository {
  constructor(private db: D1Database) {}

  /**
   * 查询系统预置及用户自定义智能体列表
   */
  public async listAgents(userId: string): Promise<Array<typeof agents.$inferSelect>> {
    const drizzleDb = getDrizzleDb(this.db);
    return await drizzleDb
      .select()
      .from(agents)
      .where(or(isNull(agents.userId), eq(agents.userId, userId)))
      .orderBy(desc(agents.isPreset), desc(agents.createdAt));
  }

  /**
   * 物理写入新增智能体
   */
  public async createAgent(params: {
    id: string;
    userId: string;
    name: string;
    avatar?: string;
    role: string;
    systemPrompt: string;
    model?: string;
    tools?: string[];
    now: string;
  }): Promise<void> {
    const drizzleDb = getDrizzleDb(this.db);
    const toolsStr = JSON.stringify(params.tools || []);
    const defaultModel = await AgentConfig.getDefaultModel(this.db);

    await drizzleDb.insert(agents).values({
      id: params.id,
      userId: params.userId,
      name: params.name.trim(),
      avatar: params.avatar?.trim() || AgentConstants.DEFAULT_AVATAR,
      role: params.role.trim(),
      systemPrompt: params.systemPrompt.trim(),
      model: params.model?.trim() || defaultModel,
      tools: toolsStr,
      isPreset: 0,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  /**
   * 修改非预置的智能体配置，返回受影响行数
   */
  public async updateAgent(userId: string, id: string, params: {
    name?: string;
    avatar?: string;
    role?: string;
    systemPrompt?: string;
    model?: string;
    tools?: string[];
    now: string;
  }): Promise<number> {
    const drizzleDb = getDrizzleDb(this.db);
    const updatePayload: Partial<typeof agents.$inferInsert> = {
      updatedAt: params.now
    };

    if (params.name !== undefined) updatePayload.name = params.name.trim();
    if (params.avatar !== undefined) updatePayload.avatar = params.avatar.trim();
    if (params.role !== undefined) updatePayload.role = params.role.trim();
    if (params.systemPrompt !== undefined) updatePayload.systemPrompt = params.systemPrompt.trim();
    if (params.model !== undefined) updatePayload.model = params.model.trim();
    if (params.tools !== undefined) updatePayload.tools = JSON.stringify(params.tools);

    const result = await drizzleDb
      .update(agents)
      .set(updatePayload)
      .where(and(eq(agents.id, id), eq(agents.userId, userId), eq(agents.isPreset, 0)));

    return result.meta.changes;
  }

  /**
   * 删除非预置的智能体配置，返回受影响行数
   */
  public async deleteAgent(id: string, userId: string): Promise<number> {
    const drizzleDb = getDrizzleDb(this.db);
    const result = await drizzleDb
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId), eq(agents.isPreset, 0)));

    return result.meta.changes;
  }
}
