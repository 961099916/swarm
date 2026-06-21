// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/services/admin.service.ts

import { CacheService, TraceLogger, getErrorMessage } from "@swarm/kernel";
import { AdminRepository } from "../repositories/admin.repository";
import { AdminConstants } from "../constants/admin.constant";
import { users } from "@swarm/identity";
import { eq, or, like, and } from "drizzle-orm";
import { ModelConfigDTO, AICallLogDTO, aiCallLogs } from "@swarm/ai-gateway";

export class AdminService {
  constructor(private adminRepo: AdminRepository) {}

  // ══════════════════════════════════════════════════
  // 用户管理
  // ══════════════════════════════════════════════════

  public async getUsers(url: URL) {
    const search = url.searchParams.get("search") || "";
    const role = url.searchParams.get("role") || "ALL";
    const status = url.searchParams.get("status") || "ALL";
    const limit = Math.min(AdminConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));

    const conditions: any[] = [];
    if (search) {
      conditions.push(or(like(users.nickname, `%${search}%`), like(users.wxOpenId, `%${search}%`), eq(users.id, search)));
    }
    if (role !== "ALL") {
      conditions.push(eq(users.role, role));
    }
    if (status === "BANNED") {
      conditions.push(eq(users.isBanned, 1));
    } else if (status === "NORMAL") {
      conditions.push(eq(users.isBanned, 0));
    }

    return await this.adminRepo.findUsers({ conditions, limit, offset });
  }

  public async updateUserRole(adminId: string, userId: string, role: string, kv: KVNamespace, traceId: string) {
    if (role !== "FREE_USER" && role !== "VIP" && role !== "ADMIN") {
      throw new Error("INVALID_ROLE");
    }
    const now = new Date().toISOString();
    const updated = await this.adminRepo.updateUserRole(userId, role, now);
    if (!updated) throw new Error("USER_NOT_FOUND");

    await CacheService.delete(kv, `user:auth:${userId}`).catch(() => {});
    await this.appendAudit(adminId, AdminConstants.AUDIT_ACTION_UPDATE_ROLE, userId, { newRole: role });
    TraceLogger.info("ADMIN", "UPDATE_ROLE_SUCCESS", traceId, `管理员修改用户角色成功: userId=${userId}, newRole=${role}`, adminId);
  }

  public async adjustUserCredits(adminId: string, userId: string, delta: number, reason: string, traceId: string) {
    if (delta === 0) throw new Error("INVALID_DELTA");
    const currentCredits = await this.adminRepo.fetchUserCredits(userId);
    if (currentCredits === null) throw new Error("USER_NOT_FOUND");

    const newBalance = currentCredits + delta;
    if (newBalance < 0) throw new Error("NEGATIVE_BALANCE");

    const now = new Date().toISOString();
    await this.adminRepo.executeCreditsAdjustment({ userId, delta, newBalance, reason, now });
    await this.appendAudit(adminId, AdminConstants.AUDIT_ACTION_ADJUST_CREDITS, userId, { delta, newBalance, reason });
    TraceLogger.info("ADMIN", "ADJUST_CREDITS_SUCCESS", traceId, `管理员调整用户积分成功: userId=${userId}, delta=${delta}, newBalance=${newBalance}`, adminId);
    return newBalance;
  }

  public async banUser(adminId: string, userId: string, isBanned: boolean, reason: string, kv: KVNamespace, traceId: string) {
    const now = new Date().toISOString();
    const bannedFlag = isBanned ? 1 : 0;
    const bannedReasonVal = isBanned ? reason || "违反服务条款" : null;

    const updated = await this.adminRepo.updateUserBanStatus(userId, bannedFlag, bannedReasonVal, now);
    if (!updated) throw new Error("USER_NOT_FOUND");

    await CacheService.delete(kv, `user:auth:${userId}`).catch(() => {});
    await this.appendAudit(adminId, isBanned ? AdminConstants.AUDIT_ACTION_BAN_USER : "UNBAN_USER", userId, { reason: bannedReasonVal });
    TraceLogger.info("ADMIN", isBanned ? "BAN_USER_SUCCESS" : "UNBAN_USER_SUCCESS", traceId, `管理员设置封禁状态成功: userId=${userId}, isBanned=${isBanned}`, adminId);
  }

  public async invalidateUserToken(adminId: string, userId: string, kv: KVNamespace, traceId: string) {
    const now = new Date().toISOString();
    const updated = await this.adminRepo.invalidateUserToken(userId, now);
    if (!updated) throw new Error("USER_NOT_FOUND");

    await CacheService.delete(kv, `user:auth:${userId}`).catch(() => {});
    await this.appendAudit(adminId, "INVALIDATE_TOKEN", userId, null);
    TraceLogger.info("ADMIN", "INVALIDATE_TOKEN_SUCCESS", traceId, `管理员强制用户下线成功: userId=${userId}`, adminId);
  }

  // ══════════════════════════════════════════════════
  // 任务管理
  // ══════════════════════════════════════════════════

  public async getTasks(url: URL) {
    const limit = Math.min(AdminConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
    return await this.adminRepo.findTasks({ conditions: [], limit, offset });
  }

  public async cancelTask(adminId: string, taskId: string, traceId: string) {
    const now = new Date().toISOString();
    const success = await this.adminRepo.cancelTask(taskId, now);
    if (!success) throw new Error("CANCEL_FAILED");

    await this.appendAudit(adminId, AdminConstants.AUDIT_ACTION_CANCEL_TASK, taskId, null);
    TraceLogger.info("ADMIN", "CANCEL_TASK_SUCCESS", traceId, `管理员取消任务成功: taskId=${taskId}`, adminId);
  }

  // ══════════════════════════════════════════════════
  // 智能体及 Prompt 管理 (强一致版本控制)
  // ══════════════════════════════════════════════════

  public async listAgents(url: URL) {
    const limit = Math.min(AdminConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "50"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
    const results = await this.adminRepo.listAgents(limit, offset);
    return results.map((row) => ({
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
      updatedAt: row.updatedAt,
    }));
  }

  public async updateAgent(adminId: string, body: any, kv: KVNamespace, traceId: string) {
    const { agentId, name, avatar, role, systemPrompt, model, tools } = body;
    if (!agentId) throw new Error("MISSING_AGENT_ID");
    if (!name?.trim()) throw new Error("MISSING_AGENT_NAME");

    const now = new Date().toISOString();
    await this.adminRepo.updateAgentWithPromptTransaction({
      agentId,
      name: name.trim(),
      avatar: avatar?.trim() || AdminConstants.DEFAULT_AGENT_AVATAR,
      role: role.trim(),
      systemPrompt: systemPrompt.trim(),
      model: model?.trim() || "",
      toolsJson: JSON.stringify(tools || []),
      now,
    });

    await CacheService.delete(kv, `prompt:agent:${agentId}:system_prompt`).catch(() => {});
    await this.appendAudit(adminId, AdminConstants.AUDIT_ACTION_UPDATE_AGENT, agentId, { name, role });
  }

  public async deleteAgent(adminId: string, agentId: string, kv: KVNamespace, traceId: string) {
    await this.adminRepo.deleteAgentWithPromptTransaction(agentId);
    await CacheService.delete(kv, `prompt:agent:${agentId}:system_prompt`).catch(() => {});
    await this.appendAudit(adminId, AdminConstants.AUDIT_ACTION_DELETE_AGENT, agentId, null);
  }

  // ══════════════════════════════════════════════════
  // 工具管理
  // ══════════════════════════════════════════════════

  public async listTools() {
    return await this.adminRepo.listTools();
  }

  public async createTool(adminId: string, body: any) {
    const { name, description, category, endpoint, method, headers, bodyTemplate, script, paramsSchema, enabled } = body;
    if (!name?.trim()) throw new Error("MISSING_TOOL_NAME");

    const now = new Date().toISOString();
    await this.adminRepo.createTool({
      name: name.trim(),
      description: description || "",
      category: category || "general",
      endpoint,
      method: method || "GET",
      headers: headers || "{}",
      bodyTemplate,
      script,
      paramsSchema: paramsSchema || "[]",
      enabled: enabled ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    });

    await this.appendAudit(adminId, AdminConstants.AUDIT_ACTION_CREATE_TOOL, name, { category });
  }

  public async updateTool(adminId: string, body: any) {
    const { name, description, category, endpoint, method, headers, bodyTemplate, script, paramsSchema, enabled } = body;
    if (!name?.trim()) throw new Error("MISSING_TOOL_NAME");

    const now = new Date().toISOString();
    const success = await this.adminRepo.updateTool(name, {
      description,
      category,
      endpoint,
      method,
      headers,
      bodyTemplate,
      script,
      paramsSchema,
      enabled: enabled ? 1 : 0,
      updatedAt: now,
    });

    if (!success) throw new Error("TOOL_NOT_FOUND");
    await this.appendAudit(adminId, AdminConstants.AUDIT_ACTION_UPDATE_TOOL, name, { category });
  }

  public async deleteTool(adminId: string, name: string) {
    const success = await this.adminRepo.deleteTool(name);
    if (!success) throw new Error("TOOL_NOT_FOUND");
    await this.appendAudit(adminId, AdminConstants.AUDIT_ACTION_DELETE_TOOL, name, null);
  }

  // ══════════════════════════════════════════════════
  // AI Gateway & 监控
  // ══════════════════════════════════════════════════

  public async listModelConfigs(): Promise<ModelConfigDTO[]> {
    const results = await this.adminRepo.listModelConfigs();
    return results.map(r => ({
      id: r.id,
      purpose: r.purpose as any,
      provider: r.provider as any,
      modelName: r.modelName,
      displayName: r.displayName || undefined,
      isDefault: r.isDefault === 1,
      isActive: r.isActive === 1,
      rateLimitRpm: r.rateLimitRpm,
      rateLimitTpm: r.rateLimitTpm,
      costPer1kInput: r.costPer1kInput,
      costPer1kOutput: r.costPer1kOutput,
      config: JSON.parse(r.configJson || "{}"),
      priority: r.priority,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  public async updateModelConfig(body: any) {
    const modelId = body.id;
    if (!modelId) throw new Error("MISSING_MODEL_ID");

    const now = new Date().toISOString();
    const updates: any = { updatedAt: now };

    if (body.isActive !== undefined) updates.isActive = body.isActive ? 1 : 0;
    if (body.isDefault !== undefined) updates.isDefault = body.isDefault ? 1 : 0;
    if (body.rateLimitRpm !== undefined) updates.rateLimitRpm = body.rateLimitRpm;
    if (body.rateLimitTpm !== undefined) updates.rateLimitTpm = body.rateLimitTpm;
    if (body.costPer1kInput !== undefined) updates.costPer1kInput = body.costPer1kInput;
    if (body.costPer1kOutput !== undefined) updates.costPer1kOutput = body.costPer1kOutput;
    if (body.displayName !== undefined) updates.displayName = body.displayName;

    if (body.isDefault) {
      const config = await this.adminRepo.findModelConfigById(modelId);
      if (config?.purpose) {
        await this.adminRepo.clearOtherDefaultModelConfigs(config.purpose, modelId);
      }
    }

    const success = await this.adminRepo.updateModelConfig(modelId, updates);
    if (!success) throw new Error("MODEL_NOT_FOUND");
  }

  public async listAICallLogs(url: URL) {
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const userId = url.searchParams.get("userId");
    const modelName = url.searchParams.get("modelName");
    const purpose = url.searchParams.get("purpose");
    const status = url.searchParams.get("status");

    const conditions: any[] = [];
    if (userId) conditions.push(eq(aiCallLogs.userId, userId));
    if (modelName) conditions.push(eq(aiCallLogs.modelName, modelName));
    if (purpose) conditions.push(eq(aiCallLogs.purpose, purpose));
    if (status) conditions.push(eq(aiCallLogs.status, status as any));

    const offset = (page - 1) * limit;
    const logs = await this.adminRepo.findAICallLogs({ conditions, limit, offset });
    const total = await this.adminRepo.countAICallLogs(conditions);

    const dtoList: AICallLogDTO[] = logs.map(r => ({
      id: r.id,
      traceId: r.traceId,
      purpose: r.purpose,
      provider: r.provider,
      modelName: r.modelName,
      userId: r.userId || undefined,
      agentId: r.agentId || undefined,
      taskId: r.taskId || undefined,
      kbId: r.kbId || undefined,
      inputTokens: r.inputTokens || 0,
      outputTokens: r.outputTokens || 0,
      latencyMs: r.latencyMs || 0,
      status: r.status as any,
      errorMessage: r.errorMessage || undefined,
      costUsd: r.costUsd || 0,
      createdAt: r.createdAt,
    }));

    return { logs: dtoList, total, page, limit };
  }

  public async getKBs(ragSvc: Fetcher | undefined, adminId: string, traceId: string) {
    if (ragSvc) {
      try {
        const response = await ragSvc.fetch(
          new Request("http://internal/rag/admin/knowledge-bases", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": adminId,
              "X-User-Role": "ADMIN",
              "X-Trace-Id": traceId,
            },
          })
        );
        if (response.ok) {
          const data = await response.json<any>();
          return data?.data || [];
        }
      } catch (err: unknown) {
        TraceLogger.warn("ADMIN", "LIST_KB_ACL_ERROR", traceId, `防腐层获取KB失败: ${getErrorMessage(err)}`);
      }
    }

    return await this.adminRepo.getKBsDirect();
  }

  public async getStatsSummary() {
    return await this.adminRepo.getAdminStatsSummary();
  }

  public async getAIStatsSummary() {
    return await this.adminRepo.getAIStatsSummary();
  }

  public async getAuditLogs(url: URL) {
    const limit = Math.min(AdminConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
    return await this.adminRepo.findAuditLogs({ conditions: [], limit, offset });
  }

  public async getTraceLogs(traceId: string) {
    return await this.adminRepo.findTraceLogs(traceId);
  }

  // ══════════════════════════════════════════════════
  // 辅助方法
  // ══════════════════════════════════════════════════

  private async appendAudit(adminId: string, action: string, targetId: string, detail: Record<string, any> | null) {
    const now = new Date().toISOString();
    await this.adminRepo.insertAuditLog({
      adminId,
      action,
      targetId,
      detail: detail ? JSON.stringify(detail) : null,
      createdAt: now,
    }).catch((err) => {
      TraceLogger.error("ADMIN", "AUDIT_LOG_WRITE_FAILED", "SYSTEM", `审计日志写入静默失败: action=${action}`, err);
    });
  }

  // ══════════════════════════════════════════════════
  // 积分台账审计只读查询
  // ══════════════════════════════════════════════════

  public async listAdRewardLogs(url: URL) {
    const limit = Math.min(AdminConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
    return await this.adminRepo.findAdRewardLogs(limit, offset);
  }

  public async listUserInvitations(url: URL) {
    const limit = Math.min(AdminConstants.DEFAULT_PAGE_LIMIT, parseInt(url.searchParams.get("limit") || "20"));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
    return await this.adminRepo.findUserInvitations(limit, offset);
  }

  // ══════════════════════════════════════════════════
  // RAG 文档内部管理 RPC 代理
  // ══════════════════════════════════════════════════

  public async getGlobalDocuments(ragSvc: Fetcher | undefined, adminId: string, url: URL, traceId: string) {
    if (!ragSvc) throw new Error("RAG_SERVICE_UNAVAILABLE");
    const response = await ragSvc.fetch(
      new Request(`http://internal/api/v1/internal/admin/documents?${url.searchParams.toString()}`, {
        method: "GET",
        headers: {
          "X-User-Id": adminId,
          "X-User-Role": "ADMIN",
          "X-Trace-Id": traceId,
        },
      })
    );
    if (!response.ok) throw new Error("FETCH_RAG_DOCS_FAILED");
    const resData = await response.json<any>();
    return resData?.data || [];
  }

  public async deleteGlobalDocument(ragSvc: Fetcher | undefined, adminId: string, docId: string, traceId: string) {
    if (!ragSvc) throw new Error("RAG_SERVICE_UNAVAILABLE");
    const response = await ragSvc.fetch(
      new Request(`http://internal/api/v1/internal/admin/documents?docId=${docId}`, {
        method: "DELETE",
        headers: {
          "X-User-Id": adminId,
          "X-User-Role": "ADMIN",
          "X-Trace-Id": traceId,
        },
      })
    );
    if (!response.ok) throw new Error("DELETE_RAG_DOC_FAILED");
    await this.appendAudit(adminId, "DELETE_DOCUMENT", docId, null);
    TraceLogger.info("ADMIN", "DELETE_DOCUMENT_SUCCESS", traceId, `管理员删除知识库文档成功: docId=${docId}`, adminId);
  }

  // ══════════════════════════════════════════════════
  // Quiz 评测内部管理 RPC 代理
  // ══════════════════════════════════════════════════

  public async resetUserQuizProgress(quizSvc: Fetcher | undefined, adminId: string, targetUserId: string, traceId: string) {
    if (!quizSvc) throw new Error("QUIZ_SERVICE_UNAVAILABLE");
    const response = await quizSvc.fetch(
      new Request(`http://internal/api/v1/internal/admin/users/reset-progress?userId=${targetUserId}`, {
        method: "POST",
        headers: {
          "X-User-Id": adminId,
          "X-User-Role": "ADMIN",
          "X-Trace-Id": traceId,
        },
      })
    );
    if (!response.ok) throw new Error("RESET_QUIZ_PROGRESS_FAILED");
    await this.appendAudit(adminId, "RESET_QUIZ_PROGRESS", targetUserId, null);
    TraceLogger.info("ADMIN", "RESET_QUIZ_PROGRESS_SUCCESS", traceId, `管理员重置用户测评进度成功: targetUserId=${targetUserId}`, adminId);
  }

  public async getQuizConfigs(quizSvc: Fetcher | undefined, adminId: string, traceId: string) {
    if (!quizSvc) throw new Error("QUIZ_SERVICE_UNAVAILABLE");
    const response = await quizSvc.fetch(
      new Request("http://internal/api/v1/internal/admin/quiz-configs", {
        method: "GET",
        headers: {
          "X-User-Id": adminId,
          "X-User-Role": "ADMIN",
          "X-Trace-Id": traceId,
        },
      })
    );
    if (!response.ok) throw new Error("FETCH_QUIZ_CONFIGS_FAILED");
    const resData = await response.json<any>();
    return resData?.data || [];
  }

  public async updateQuizConfigs(quizSvc: Fetcher | undefined, adminId: string, configs: any[], traceId: string) {
    if (!quizSvc) throw new Error("QUIZ_SERVICE_UNAVAILABLE");
    const response = await quizSvc.fetch(
      new Request("http://internal/api/v1/internal/admin/quiz-configs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": adminId,
          "X-User-Role": "ADMIN",
          "X-Trace-Id": traceId,
        },
        body: JSON.stringify({ configs }),
      })
    );
    if (!response.ok) throw new Error("UPDATE_QUIZ_CONFIGS_FAILED");
    await this.appendAudit(adminId, "UPDATE_QUIZ_CONFIGS", "SYSTEM", { configsCount: configs.length });
    TraceLogger.info("ADMIN", "UPDATE_QUIZ_CONFIGS_SUCCESS", traceId, `管理员修改评测系统配置成功`, adminId);
  }

  // ══════════════════════════════════════════════════
  // Prompt 提示词版本管理业务逻辑
  // ══════════════════════════════════════════════════

  public async listPrompts(adminId: string, traceId: string) {
    return await this.adminRepo.listPrompts();
  }

  public async listPromptVersions(adminId: string, key: string, traceId: string) {
    return await this.adminRepo.listPromptVersions(key);
  }

  public async setPromptActiveVersion(
    adminId: string,
    key: string,
    version: number,
    kv: KVNamespace,
    traceId: string
  ): Promise<void> {
    await this.adminRepo.setPromptActiveVersion(key, version);
    const cacheKey = `prompt:${key}`;
    await kv.delete(cacheKey).catch(() => {});
    await this.appendAudit(adminId, "SET_PROMPT_ACTIVE", `${key}:v${version}`, null);
    TraceLogger.info("ADMIN", "SET_PROMPT_ACTIVE_SUCCESS", traceId, `管理员切换Prompt激活版本成功: key=${key}, version=${version}`, adminId);
  }

  public async createPromptVersion(
    adminId: string,
    key: string,
    content: string,
    description: string,
    kv: KVNamespace,
    traceId: string
  ): Promise<number> {
    const newVer = await this.adminRepo.createPromptVersion(key, content, description);
    const cacheKey = `prompt:${key}`;
    await kv.delete(cacheKey).catch(() => {});
    await this.appendAudit(adminId, "CREATE_PROMPT_VERSION", `${key}:v${newVer}`, { description });
    TraceLogger.info("ADMIN", "CREATE_PROMPT_VERSION_SUCCESS", traceId, `管理员发布Prompt新版本成功: key=${key}, version=${newVer}`, adminId);
    return newVer;
  }
}
