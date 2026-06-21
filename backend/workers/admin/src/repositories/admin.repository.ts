// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/repositories/admin.repository.ts

import { drizzle } from "drizzle-orm/d1";
import { eq, and, or, like, desc, sql } from "drizzle-orm";
import { users } from "@swarm/identity";
import { adminAuditLogs, agents, tools, tasks } from "@swarm/agent";
import { modelConfigs, aiCallLogs } from "@swarm/ai-gateway";
import { creditsLedger, adRewardLogs, userInvitations } from "@swarm/credits";

export class AdminRepository {
  constructor(public db: D1Database) {}

  private getDrizzle() {
    return drizzle(this.db);
  }

  // ══════════════════════════════════════════════════
  // 用户相关 CRUD
  // ══════════════════════════════════════════════════

  public async findUsers(params: {
    conditions: any[];
    limit: number;
    offset: number;
  }) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select()
      .from(users)
      .where(params.conditions.length > 0 ? and(...params.conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(params.limit)
      .offset(params.offset);
  }

  public async updateUserRole(userId: string, role: string, now: string) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb
      .update(users)
      .set({ role, tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: now })
      .where(eq(users.id, userId));
    return result.meta.changes > 0;
  }

  public async updateUserBanStatus(userId: string, isBanned: number, reason: string | null, now: string) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb
      .update(users)
      .set({
        isBanned,
        bannedReason: reason,
        tokenVersion: sql`${users.tokenVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
    return result.meta.changes > 0;
  }

  public async invalidateUserToken(userId: string, now: string) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: now })
      .where(eq(users.id, userId));
    return result.meta.changes > 0;
  }

  public async fetchUserCredits(userId: string): Promise<number | null> {
    const drizzleDb = this.getDrizzle();
    const res = await drizzleDb.select({ credits: users.credits }).from(users).where(eq(users.id, userId));
    return res.length > 0 ? res[0].credits : null;
  }

  public async executeCreditsAdjustment(params: {
    userId: string;
    delta: number;
    newBalance: number;
    reason: string;
    now: string;
  }): Promise<void> {
    const drizzleDb = this.getDrizzle();
    const { userId, delta, newBalance, reason, now } = params;

    await drizzleDb.batch([
      drizzleDb.update(users).set({ credits: sql`credits + ${delta}`, updatedAt: now }).where(eq(users.id, userId)),
      drizzleDb.insert(creditsLedger).values({
        userId,
        delta,
        balance: newBalance,
        reason: "ADMIN_ADJUST",
        refId: reason || "管理员后台调整",
        createdAt: now,
      }),
    ]);
  }

  // ══════════════════════════════════════════════════
  // 任务管理 CRUD
  // ══════════════════════════════════════════════════

  public async findTasks(params: {
    conditions: any[];
    limit: number;
    offset: number;
  }) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select()
      .from(tasks)
      .where(params.conditions.length > 0 ? and(...params.conditions) : undefined)
      .orderBy(desc(tasks.createdAt))
      .limit(params.limit)
      .offset(params.offset);
  }

  public async cancelTask(taskId: string, now: string) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb
      .update(tasks)
      .set({ status: "CANCELLED", updatedAt: now })
      .where(and(eq(tasks.id, taskId), or(eq(tasks.status, "PENDING"), eq(tasks.status, "RUNNING"))));
    return result.meta.changes > 0;
  }

  // ══════════════════════════════════════════════════
  // 智能体与 Prompt 级联事务
  // ══════════════════════════════════════════════════

  public async listAgents(limit: number, offset: number) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select()
      .from(agents)
      .orderBy(desc(agents.isPreset), desc(agents.createdAt))
      .limit(limit)
      .offset(offset);
  }

  public async updateAgentWithPromptTransaction(params: {
    agentId: string;
    name: string;
    avatar: string;
    role: string;
    systemPrompt: string;
    model: string;
    toolsJson: string;
    now: string;
  }): Promise<boolean> {
    const key = `agent:${params.agentId}:system_prompt`;

    const versionRow = await this.db
      .prepare("SELECT version FROM prompts WHERE key = ? ORDER BY version DESC LIMIT 1")
      .bind(key)
      .first<{ version: number }>();
    const currentVersion = versionRow?.version || 0;
    const newVersion = currentVersion + 1;

    await this.db.batch([
      this.db.prepare("UPDATE prompts SET is_active = 0 WHERE key = ?").bind(key),
      this.db.prepare("INSERT INTO prompts (key, version, content, description, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)")
        .bind(key, newVersion, params.systemPrompt, `智能体 [${params.name}] 系统提示词 v${newVersion}`, params.now),
      this.db.prepare("UPDATE agents SET name = ?, avatar = ?, role = ?, system_prompt = ?, model = ?, tools = ?, updated_at = ? WHERE id = ?")
        .bind(params.name, params.avatar, params.role, key, params.model, params.toolsJson, params.now, params.agentId)
    ]);

    return true;
  }

  public async deleteAgentWithPromptTransaction(agentId: string): Promise<boolean> {
    const key = `agent:${agentId}:system_prompt`;

    await this.db.batch([
      this.db.prepare("DELETE FROM agents WHERE id = ? AND is_preset = 0").bind(agentId),
      this.db.prepare("DELETE FROM prompts WHERE key = ?").bind(key)
    ]);

    return true;
  }

  // ══════════════════════════════════════════════════
  // 工具管理 CRUD
  // ══════════════════════════════════════════════════

  public async listTools() {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb.select().from(tools).orderBy(desc(tools.createdAt));
  }

  public async createTool(values: any) {
    const drizzleDb = this.getDrizzle();
    await drizzleDb.insert(tools).values(values);
  }

  public async updateTool(name: string, values: any) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb.update(tools).set(values).where(eq(tools.name, name));
    return result.meta.changes > 0;
  }

  public async deleteTool(name: string) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb.delete(tools).where(eq(tools.name, name));
    return result.meta.changes > 0;
  }

  public async findToolByName(name: string) {
    const drizzleDb = this.getDrizzle();
    const res = await drizzleDb.select().from(tools).where(eq(tools.name, name));
    return res[0] || null;
  }

  // ══════════════════════════════════════════════════
  // 审计日志
  // ══════════════════════════════════════════════════

  public async insertAuditLog(values: any) {
    const drizzleDb = this.getDrizzle();
    await drizzleDb.insert(adminAuditLogs).values(values);
  }

  public async findAuditLogs(params: {
    conditions: any[];
    limit: number;
    offset: number;
  }) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select()
      .from(adminAuditLogs)
      .where(params.conditions.length > 0 ? and(...params.conditions) : undefined)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(params.limit)
      .offset(params.offset);
  }

  // ══════════════════════════════════════════════════
  // AI Gateway CRUD 与查询
  // ══════════════════════════════════════════════════

  public async listModelConfigs() {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb.select().from(modelConfigs).orderBy(desc(modelConfigs.priority));
  }

  public async updateModelConfig(id: string, values: any) {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb.update(modelConfigs).set(values).where(eq(modelConfigs.id, id));
    return result.meta.changes > 0;
  }

  public async clearOtherDefaultModelConfigs(purpose: string, exceptId: string) {
    const drizzleDb = this.getDrizzle();
    await drizzleDb
      .update(modelConfigs)
      .set({ isDefault: 0 })
      .where(and(eq(modelConfigs.purpose, purpose as any), sql`id != ${exceptId}`));
  }

  public async findModelConfigById(id: string) {
    const drizzleDb = this.getDrizzle();
    const res = await drizzleDb.select().from(modelConfigs).where(eq(modelConfigs.id, id));
    return res[0] || null;
  }

  public async findAICallLogs(params: {
    conditions: any[];
    limit: number;
    offset: number;
  }) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select()
      .from(aiCallLogs)
      .where(params.conditions.length > 0 ? and(...params.conditions) : undefined)
      .orderBy(desc(aiCallLogs.createdAt))
      .limit(params.limit)
      .offset(params.offset);
  }

  public async countAICallLogs(conditions: any[]): Promise<number> {
    const drizzleDb = this.getDrizzle();
    const res = await drizzleDb
      .select({ count: sql`COUNT(*)` })
      .from(aiCallLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return (res[0] as any)?.count || 0;
  }

  public async getAIStatsSummary() {
    const totalCalls = await this.db.prepare("SELECT COUNT(*) as count FROM ai_call_logs").first<{ count: number }>();
    const successCalls = await this.db.prepare("SELECT COUNT(*) as count FROM ai_call_logs WHERE status = 'SUCCESS'").first<{ count: number }>();
    const totalTokens = await this.db.prepare("SELECT SUM(input_tokens + output_tokens) as tokens FROM ai_call_logs").first<{ tokens: number }>();
    const totalCost = await this.db.prepare("SELECT SUM(cost_usd) as cost FROM ai_call_logs").first<{ cost: number }>();

    const byModel = await this.db.prepare(`
      SELECT model_name, COUNT(*) as count, COALESCE(SUM(cost_usd), 0) as cost_usd
      FROM ai_call_logs
      GROUP BY model_name
      ORDER BY count DESC
    `).all<any>().then(res => res.results || []);

    const byHour = await this.db.prepare(`
      SELECT substr(created_at, 1, 13) as hour, COUNT(*) as count
      FROM ai_call_logs
      GROUP BY hour
      ORDER BY hour
    `).all<any>().then(res => res.results || []);

    return {
      totalCalls: totalCalls?.count || 0,
      successRate: totalCalls?.count ? (successCalls?.count || 0) / totalCalls.count : 0,
      totalTokens: totalTokens?.tokens || 0,
      totalCostUsd: totalCost?.cost || 0,
      callsByModel: byModel.map((r: any) => ({ modelName: r.model_name, count: r.count, costUsd: r.cost_usd })),
      callsByHour: byHour.map((r: any) => ({ hour: r.hour, count: r.count })),
    };
  }

  public async getAdminStatsSummary() {
    const totalUsers = await this.db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
    const totalTasks = await this.db.prepare("SELECT COUNT(*) as count FROM tasks").first<{ count: number }>();
    const activeTasks = await this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'RUNNING'").first<{ count: number }>();
    const totalCreditsUsed = await this.db.prepare("SELECT SUM(credits_cost) as credits FROM tasks WHERE status = 'SUCCESS'").first<{ credits: number }>();

    return {
      totalUsers: totalUsers?.count || 0,
      totalTasks: totalTasks?.count || 0,
      activeTasks: activeTasks?.count || 0,
      totalCreditsUsed: totalCreditsUsed?.credits || 0,
    };
  }

  public async getKBsDirect() {
    return await this.db
      .prepare(`
        SELECT kb.*,
          (SELECT COUNT(*) FROM documents d WHERE d.kb_id = kb.id) as doc_count,
          u.nickname as owner_name
        FROM knowledge_bases kb
        LEFT JOIN users u ON u.id = kb.user_id
        ORDER BY kb.created_at DESC
      `)
      .all<any>()
      .then(res => res.results || []);
  }

  public async findAdRewardLogs(limit: number, offset: number) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select({
        id: adRewardLogs.id,
        userId: adRewardLogs.userId,
        adTokenHash: adRewardLogs.adTokenHash,
        creditsAdded: adRewardLogs.creditsAdded,
        createdAt: adRewardLogs.createdAt,
        nickname: users.nickname
      })
      .from(adRewardLogs)
      .leftJoin(users, eq(users.id, adRewardLogs.userId))
      .orderBy(desc(adRewardLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  public async findUserInvitations(limit: number, offset: number) {
    const drizzleDb = this.getDrizzle();
    return await drizzleDb
      .select({
        id: userInvitations.id,
        inviterId: userInvitations.inviterId,
        inviteeId: userInvitations.inviteeId,
        bonusGiven: userInvitations.bonusGiven,
        createdAt: userInvitations.createdAt,
        inviterName: users.nickname
      })
      .from(userInvitations)
      .leftJoin(users, eq(users.id, userInvitations.inviterId))
      .orderBy(desc(userInvitations.createdAt))
      .limit(limit)
      .offset(offset);
  }

  public async listPrompts(): Promise<Array<{
    key: string;
    activeVersion: number;
    latestVersion: number;
    description: string | null;
    lastUpdated: string;
  }>> {
    const result = await this.db.prepare(`
      SELECT 
        key,
        MAX(CASE WHEN is_active = 1 THEN version ELSE 0 END) as activeVersion,
        MAX(version) as latestVersion,
        MAX(description) as description,
        MAX(created_at) as lastUpdated
      FROM prompts
      GROUP BY key
      ORDER BY lastUpdated DESC
    `).all<any>();
    
    return (result.results || []).map(r => ({
      key: r.key,
      activeVersion: Number(r.activeVersion),
      latestVersion: Number(r.latestVersion),
      description: r.description,
      lastUpdated: r.lastUpdated,
    }));
  }

  public async listPromptVersions(key: string): Promise<Array<{
    key: string;
    version: number;
    content: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
  }>> {
    const result = await this.db.prepare(`
      SELECT key, version, content, description, is_active, created_at
      FROM prompts
      WHERE key = ?
      ORDER BY version DESC
    `).bind(key).all<any>();

    return (result.results || []).map(r => ({
      key: r.key,
      version: Number(r.version),
      content: r.content,
      description: r.description,
      isActive: r.is_active === 1,
      createdAt: r.created_at,
    }));
  }

  public async setPromptActiveVersion(key: string, version: number): Promise<boolean> {
    await this.db.batch([
      this.db.prepare("UPDATE prompts SET is_active = 0 WHERE key = ?").bind(key),
      this.db.prepare("UPDATE prompts SET is_active = 1 WHERE key = ? AND version = ?").bind(key, version)
    ]);
    return true;
  }

  public async createPromptVersion(key: string, content: string, description: string): Promise<number> {
    const versionRow = await this.db
      .prepare("SELECT version FROM prompts WHERE key = ? ORDER BY version DESC LIMIT 1")
      .bind(key)
      .first<{ version: number }>();
      
    const latestVersion = versionRow?.version || 0;
    const newVersion = latestVersion + 1;
    const now = new Date().toISOString();

    await this.db.batch([
      this.db.prepare("UPDATE prompts SET is_active = 0 WHERE key = ?").bind(key),
      this.db.prepare("INSERT INTO prompts (key, version, content, description, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)")
        .bind(key, newVersion, content, description, now)
    ]);

    return newVersion;
  }

  public async findTraceLogs(traceId: string) {
    // 1. 查询 AI 调用日志
    const aiLogs = await this.db
      .prepare("SELECT * FROM ai_call_logs WHERE trace_id = ? ORDER BY created_at ASC")
      .bind(traceId)
      .all<any>()
      .then(res => res.results || []);

    // 2. 查询审计日志 (通过 detail 模糊匹配 traceId)
    const auditLogs = await this.db
      .prepare("SELECT * FROM admin_audit_logs WHERE detail LIKE ? ORDER BY created_at ASC")
      .bind(`%${traceId}%`)
      .all<any>()
      .then(res => res.results || []);

    // 3. 查询任务日志 (通过 message 模糊匹配 traceId)
    const taskLogsList = await this.db
      .prepare("SELECT * FROM task_logs WHERE message LIKE ? ORDER BY created_at ASC")
      .bind(`%${traceId}%`)
      .all<any>()
      .then(res => res.results || []);

    return {
      aiLogs,
      auditLogs,
      taskLogs: taskLogsList
    };
  }
}
