// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/controllers/admin.controller.ts

import { ApiRes, TraceLogger, getErrorMessage } from "@swarm/kernel";
import { AdminService } from "../services/admin.service";

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
}
