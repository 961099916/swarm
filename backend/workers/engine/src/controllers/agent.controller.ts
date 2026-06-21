// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/controllers/agent.controller.ts

import { CreateAgentReq, UpdateAgentReq } from "@swarm/agent";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";
import { AgentService } from "../services/agent.service";
import { ResponseBuilder } from "../utils/response";
import {
  RequiredFieldsValidator,
  ModelWhitelistValidator,
  ToolsSecurityValidator,
  ValidatorChain
} from "../utils/validator";

function buildCreateValidatorChain(): ValidatorChain<CreateAgentReq> {
  return new ValidatorChain<CreateAgentReq>()
    .add(new RequiredFieldsValidator(["name", "role", "systemPrompt"]))
    .add(new ModelWhitelistValidator())
    .add(new ToolsSecurityValidator());
}

function buildUpdateValidatorChain(): ValidatorChain<UpdateAgentReq> {
  return new ValidatorChain<UpdateAgentReq>()
    .add(new RequiredFieldsValidator(["id", "name", "role", "systemPrompt"]))
    .add(new ModelWhitelistValidator())
    .add(new ToolsSecurityValidator());
}

/**
 * 智能体控制器，承载请求的入参验证与路由分发
 */
export class AgentController {
  constructor(private agentSvc: AgentService) {}

  /**
   * 获取智能体列表 (GET /api/v1/agents/list)
   */
  public async handleListAgents(
    kv: KVNamespace,
    userId: string,
    traceId: string
  ): Promise<Response> {
    try {
      const dtoList = await this.agentSvc.listAgents(kv, userId, traceId);
      return ResponseBuilder.success(dtoList, traceId);
    } catch (error: unknown) {
      TraceLogger.error("ENGINE", "LIST_AGENTS_FAILED", traceId, `获取智能体列表异常: ${getErrorMessage(error)}`, error, userId);
      return ResponseBuilder.internalError("系统查询智能体列表失败", traceId);
    }
  }

  /**
   * 创建自定义智能体 (POST /api/v1/agents/create)
   */
  public async handleCreateAgent(
    request: Request,
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

      const agentId = await this.agentSvc.createAgent(kv, userId, body, traceId);
      return ResponseBuilder.success({ agentId }, traceId);
    } catch (error: unknown) {
      TraceLogger.error("ENGINE", "CREATE_AGENT_FAILED", traceId, `创建自定义智能体失败: ${getErrorMessage(error)}`, error, userId);
      return ResponseBuilder.internalError("系统部署自定义智能体失败", traceId);
    }
  }

  /**
   * 更新自定义智能体 (PUT /api/v1/agents/update)
   */
  public async handleUpdateAgent(
    request: Request,
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

      await this.agentSvc.updateAgent(kv, userId, body, traceId);
      return ResponseBuilder.success({ agentId: body.id }, traceId);
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error);
      TraceLogger.error("ENGINE", "UPDATE_AGENT_FAILED", traceId, `更新智能体失败: ${errMsg}`, error, userId);
      if (errMsg === "AGENT_NOT_FOUND_OR_FORBIDDEN") {
        return ResponseBuilder.forbidden("智能体不存在或您无权修改此内置智能体", traceId);
      }
      return ResponseBuilder.internalError("修改自定义智能体失败", traceId);
    }
  }

  /**
   * 删除自定义智能体 (DELETE /api/v1/agents/delete)
   */
  public async handleDeleteAgent(
    request: Request,
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

      await this.agentSvc.deleteAgent(kv, userId, agentId, traceId);
      return ResponseBuilder.success({ success: true }, traceId);
    } catch (error: unknown) {
      const errMsg = getErrorMessage(error);
      TraceLogger.error("ENGINE", "DELETE_AGENT_FAILED", traceId, `删除智能体失败: ${errMsg}`, error, userId);
      if (errMsg === "AGENT_NOT_FOUND_OR_FORBIDDEN") {
        return ResponseBuilder.forbidden("智能体不存在或您无权删除此内置智能体", traceId);
      }
      return ResponseBuilder.internalError("下线自定义智能体失败", traceId);
    }
  }
}
