import { ApiRes, TraceLogger, getErrorMessage, ConfigService } from "@swarm/kernel";
import { AdminService } from "../services/admin.service";
import { z } from "zod";

export class AdminController {
  constructor(private adminService: AdminService) {}

  public async getStats(traceId: string): Promise<Response> {
    try {
      const stats = await this.adminService.getStatsSummary();
      return ApiRes.success(stats, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "GET_STATS_CTRL_ERR", traceId, "获取统计失败", err);
      return ApiRes.internalError("系统加载统计异常", traceId);
    }
  }

  public async getUsers(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.adminService.getUsers(url);
      return ApiRes.success(list, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "GET_USERS_CTRL_ERR", traceId, "获取用户失败", err);
      return ApiRes.internalError("系统查询用户列表异常", traceId);
    }
  }

  public async updateUserRole(
    adminId: string,
    userId: string,
    request: Request,
    kv: KVNamespace,
    traceId: string
  ): Promise<Response> {
    try {
      const body = await request.json() as { role?: string };
      await this.adminService.updateUserRole(adminId, userId, body.role || "", kv, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "INVALID_ROLE") return ApiRes.badRequest("非法的用户角色类型", traceId);
      if (msg === "USER_NOT_FOUND") return ApiRes.error(1030, "目标用户不存在", traceId);
      return ApiRes.internalError("系统修改角色异常", traceId);
    }
  }

  public async adjustUserCredits(
    adminId: string,
    userId: string,
    request: Request,
    traceId: string
  ): Promise<Response> {
    try {
      const body = await request.json() as { delta?: number; reason?: string };
      const newBal = await this.adminService.adjustUserCredits(adminId, userId, body.delta || 0, body.reason || "", traceId);
      return ApiRes.success({ newBalance: newBal }, traceId);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg === "INVALID_DELTA") return ApiRes.badRequest("请输入有效的调整数量", traceId);
      if (msg === "USER_NOT_FOUND") return ApiRes.error(1030, "目标用户不存在", traceId);
      if (msg === "NEGATIVE_BALANCE") return ApiRes.badRequest("调整后积分不能为负数", traceId);
      return ApiRes.internalError("系统调整积分异常", traceId);
    }
  }

  public async banUser(
    adminId: string,
    userId: string,
    request: Request,
    kv: KVNamespace,
    traceId: string
  ): Promise<Response> {
    try {
      const body = await request.json() as { isBanned?: boolean; reason?: string };
      await this.adminService.banUser(adminId, userId, !!body.isBanned, body.reason || "", kv, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      if (getErrorMessage(err) === "USER_NOT_FOUND") return ApiRes.error(1030, "目标用户不存在", traceId);
      return ApiRes.internalError("系统更新账号封禁状态异常", traceId);
    }
  }

  public async invalidateUserToken(
    adminId: string,
    userId: string,
    kv: KVNamespace,
    traceId: string
  ): Promise<Response> {
    try {
      await this.adminService.invalidateUserToken(adminId, userId, kv, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      if (getErrorMessage(err) === "USER_NOT_FOUND") return ApiRes.error(1030, "目标用户不存在", traceId);
      return ApiRes.internalError("系统下线操作异常", traceId);
    }
  }

  public async getTasks(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.adminService.getTasks(url);
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("系统查询全局任务异常", traceId);
    }
  }

  public async cancelTask(adminId: string, taskId: string, traceId: string): Promise<Response> {
    try {
      await this.adminService.cancelTask(adminId, taskId, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.badRequest("取消任务失败，可能任务已经结束", traceId);
    }
  }

  public async getAgents(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.adminService.listAgents(url);
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("系统查询全局智能体异常", traceId);
    }
  }

  public async updateAgent(adminId: string, request: Request, kv: KVNamespace, traceId: string): Promise<Response> {
    try {
      const body = await request.json();
      await this.adminService.updateAgent(adminId, body, kv, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("系统修改智能体异常", traceId);
    }
  }

  public async deleteAgent(adminId: string, request: Request, kv: KVNamespace, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const agentId = url.searchParams.get("agentId");
      if (!agentId) return ApiRes.badRequest("缺少 agentId", traceId);

      await this.adminService.deleteAgent(adminId, agentId, kv, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("系统删除智能体异常", traceId);
    }
  }

  public async listTools(traceId: string): Promise<Response> {
    try {
      const list = await this.adminService.listTools();
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("系统查询工具失败", traceId);
    }
  }

  public async createTool(adminId: string, request: Request, traceId: string): Promise<Response> {
    try {
      const body = await request.json();
      await this.adminService.createTool(adminId, body);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.badRequest("创建工具失败，参数有误", traceId);
    }
  }

  public async updateTool(adminId: string, request: Request, traceId: string): Promise<Response> {
    try {
      const body = await request.json();
      await this.adminService.updateTool(adminId, body);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.badRequest("更新工具失败", traceId);
    }
  }

  public async deleteTool(adminId: string, request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");
      if (!name) return ApiRes.badRequest("缺少 name", traceId);
      await this.adminService.deleteTool(adminId, name);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("删除工具异常", traceId);
    }
  }

  public async getAIStats(traceId: string): Promise<Response> {
    try {
      const stats = await this.adminService.getAIStatsSummary();
      return ApiRes.success(stats, traceId);
    } catch (err) {
      return ApiRes.internalError("查询 AI 统计失败", traceId);
    }
  }

  public async listModelConfigs(traceId: string): Promise<Response> {
    try {
      const configs = await this.adminService.listModelConfigs();
      return ApiRes.success(configs, traceId);
    } catch (err) {
      return ApiRes.internalError("查询模型配置失败", traceId);
    }
  }

  public async updateModelConfig(request: Request, traceId: string): Promise<Response> {
    try {
      const body = await request.json();
      await this.adminService.updateModelConfig(body);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.badRequest("修改模型配置失败", traceId);
    }
  }

  public async listAICallLogs(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const result = await this.adminService.listAICallLogs(url);
      return ApiRes.success(result, traceId);
    } catch (err) {
      return ApiRes.internalError("查询 AI 日志失败", traceId);
    }
  }

  public async getKBs(request: Request, ragSvc: Fetcher | undefined, adminId: string, traceId: string): Promise<Response> {
    try {
      const list = await this.adminService.getKBs(ragSvc, adminId, traceId);
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("获取知识库失败", traceId);
    }
  }

  public async getAuditLogs(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.adminService.getAuditLogs(url);
      return ApiRes.success(list, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "GET_AUDIT_LOGS_CTRL_ERR", traceId, "获取审计日志失败", err);
      return ApiRes.internalError("系统查询审计日志异常", traceId);
    }
  }

  public async listAdRewardLogs(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.adminService.listAdRewardLogs(url);
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("查询广告奖励流水异常", traceId);
    }
  }

  public async listUserInvitations(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.adminService.listUserInvitations(url);
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("查询裂变邀请流水异常", traceId);
    }
  }

  public async getGlobalDocuments(request: Request, ragSvc: Fetcher | undefined, adminId: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const list = await this.adminService.getGlobalDocuments(ragSvc, adminId, url, traceId);
      return ApiRes.success(list, traceId);
    } catch (err) {
      return ApiRes.internalError("跨服务查询全局文档失败", traceId);
    }
  }

  public async deleteGlobalDocument(request: Request, ragSvc: Fetcher | undefined, adminId: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const docId = url.searchParams.get("docId");
      if (!docId) return ApiRes.badRequest("缺少 docId", traceId);
      await this.adminService.deleteGlobalDocument(ragSvc, adminId, docId, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("跨服务删除文档失败", traceId);
    }
  }

  public async resetUserQuizProgress(request: Request, quizSvc: Fetcher | undefined, adminId: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const targetUserId = url.searchParams.get("userId");
      if (!targetUserId) return ApiRes.badRequest("缺少 target userId", traceId);
      await this.adminService.resetUserQuizProgress(quizSvc, adminId, targetUserId, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("跨服务重置用户评测进度失败", traceId);
    }
  }

  public async getQuizConfigs(quizSvc: Fetcher | undefined, adminId: string, traceId: string): Promise<Response> {
    try {
      const configs = await this.adminService.getQuizConfigs(quizSvc, adminId, traceId);
      return ApiRes.success(configs, traceId);
    } catch (err) {
      return ApiRes.internalError("跨服务读取评测配置失败", traceId);
    }
  }

  public async updateQuizConfigs(request: Request, quizSvc: Fetcher | undefined, adminId: string, traceId: string): Promise<Response> {
    try {
      const body = await request.json() as { configs?: any[] };
      if (!body.configs || !Array.isArray(body.configs)) {
        return ApiRes.badRequest("参数错误：configs 字段有误", traceId);
      }
      await this.adminService.updateQuizConfigs(quizSvc, adminId, body.configs, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      return ApiRes.internalError("跨服务更新评测配置失败", traceId);
    }
  }

  public async listPrompts(adminId: string, traceId: string): Promise<Response> {
    try {
      const list = await this.adminService.listPrompts(adminId, traceId);
      return ApiRes.success(list, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "LIST_PROMPTS_CTRL_ERR", traceId, "获取 Prompt 列表失败", err);
      return ApiRes.internalError("系统加载提示词列表异常", traceId);
    }
  }

  public async listPromptVersions(request: Request, adminId: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const key = url.searchParams.get("key");
      if (!key) return ApiRes.badRequest("缺少 key 参数", traceId);

      const list = await this.adminService.listPromptVersions(adminId, key, traceId);
      return ApiRes.success(list, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "LIST_PROMPT_VERSIONS_CTRL_ERR", traceId, "获取 Prompt 版本历史失败", err);
      return ApiRes.internalError("系统加载提示词历史版本异常", traceId);
    }
  }

  public async setPromptActiveVersion(
    request: Request,
    adminId: string,
    kv: KVNamespace,
    traceId: string
  ): Promise<Response> {
    try {
      const body = await request.json() as { key?: string; version?: number };
      if (!body.key || body.version === undefined) {
        return ApiRes.badRequest("参数错误：缺少 key 或 version 字段", traceId);
      }
      await this.adminService.setPromptActiveVersion(adminId, body.key, body.version, kv, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "SET_PROMPT_ACTIVE_CTRL_ERR", traceId, "切换 Prompt 激活版本失败", err);
      return ApiRes.internalError("系统切换提示词激活版本异常", traceId);
    }
  }

  public async createPromptVersion(
    request: Request,
    adminId: string,
    kv: KVNamespace,
    traceId: string
  ): Promise<Response> {
    try {
      const body = await request.json() as { key?: string; content?: string; description?: string };
      if (!body.key || !body.content) {
        return ApiRes.badRequest("参数错误：缺少 key 或 content 字段", traceId);
      }
      const newVersion = await this.adminService.createPromptVersion(
        adminId,
        body.key,
        body.content,
        body.description || "",
        kv,
        traceId
      );
      return ApiRes.success({ success: true, version: newVersion }, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "CREATE_PROMPT_VERSION_CTRL_ERR", traceId, "发布 Prompt 新版本失败", err);
      return ApiRes.internalError("系统发布提示词新版本异常", traceId);
    }
  }

  public async getConfigs(db: D1Database, traceId: string): Promise<Response> {
    try {
      const allConfigs = await ConfigService.getAll(db);
      return ApiRes.success(allConfigs, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "GET_CONFIGS_CTRL_ERR", traceId, "获取系统动态配置失败", err);
      return ApiRes.internalError("系统获取配置异常", traceId);
    }
  }

  public async updateConfig(
    db: D1Database,
    adminId: string,
    request: Request,
    kv: KVNamespace | undefined,
    traceId: string
  ): Promise<Response> {
    try {
      const updateConfigSchema = z.union([
        z.object({
          key: z.string({ message: "参数错误：缺少 key 字段" }),
          value: z.union([z.string(), z.number()], { message: "参数错误：缺少 value 字段" })
        }),
        z.object({
          configs: z.array(
            z.object({
              key: z.string({ message: "参数错误：缺少 key 字段" }),
              value: z.union([z.string(), z.number()], { message: "参数错误：缺少 value 字段" })
            })
          )
        })
      ]);

      const bodyJson = await request.json();
      const parsed = updateConfigSchema.safeParse(bodyJson);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues.map((issue: any) => issue.message).join(", ");
        return ApiRes.badRequest(errorMsg, traceId);
      }

      const data = parsed.data;

      // 1. 批量更新处理分支
      if ("configs" in data) {
        const { configs } = data;

        // 校验所有 key 是否合法
        for (const item of configs) {
          if (!ConfigService.isValidKey(item.key)) {
            return ApiRes.badRequest(`非法的配置键名: ${item.key}`, traceId);
          }
        }

        // 循环执行更新并写入审计日志
        for (const item of configs) {
          await ConfigService.set(db, item.key as any, item.value, kv);
          await (this.adminService as any).appendAudit(adminId, "UPDATE_CONFIG", item.key, { value: item.value });
        }

        TraceLogger.info(
          "ADMIN",
          "BATCH_UPDATE_CONFIG_SUCCESS",
          traceId,
          `管理员批量更新系统配置成功: count=${configs.length}`,
          adminId
        );

        return ApiRes.success({ success: true }, traceId);
      }

      // 2. 单条更新处理分支
      const { key, value } = data;

      if (!ConfigService.isValidKey(key)) {
        return ApiRes.badRequest(`非法的配置键名: ${key}`, traceId);
      }

      // 写入配置并清除/更新缓存
      await ConfigService.set(db, key as any, value, kv);

      // 记录管理端操作审计日志
      await (this.adminService as any).appendAudit(adminId, "UPDATE_CONFIG", key, { value });

      TraceLogger.info(
        "ADMIN",
        "UPDATE_CONFIG_SUCCESS",
        traceId,
        `管理员更新系统配置成功: key=${key}, value=${value}`,
        adminId
      );

      return ApiRes.success({ success: true }, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "UPDATE_CONFIG_CTRL_ERR", traceId, "更新系统配置失败", err);
      return ApiRes.internalError("系统更新配置异常", traceId);
    }
  }

  public async getTraceLogs(request: Request, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const targetTraceId = url.searchParams.get("targetTraceId") || "";
      if (!targetTraceId) {
        return ApiRes.badRequest("参数错误：缺少 targetTraceId 字段", traceId);
      }
      const data = await this.adminService.getTraceLogs(targetTraceId);
      return ApiRes.success(data, traceId);
    } catch (err) {
      TraceLogger.error("ADMIN", "GET_TRACE_LOGS_CTRL_ERR", traceId, "获取全链路日志失败", err);
      return ApiRes.internalError("系统获取全链路日志异常", traceId);
    }
  }
}
