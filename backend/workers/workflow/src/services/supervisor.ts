// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/services/supervisor.ts

import { AgentRow } from "@swarm/agent";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";
import { ToolRegistry } from "../tools";
import { callLlmChatAndLog } from "./ai";
import { appendTaskLog, safeParseJSON, PromptManager } from "../utils";
import { WorkflowConstants } from "../constants/workflow.constant";

export class SupervisorService {
  constructor(private env: { DB: D1Database; AI: any; CACHE_KV?: any; LOG_QUEUE?: any }) {}

  /**
   * 让 Supervisor (主控) 做出下一步路由规划决策
   */
  public async getSupervisorDecision(
    taskId: string,
    goal: string,
    agents: AgentRow[],
    memory: Array<{ role: string; content: string }>
  ): Promise<{ thought: string; action: string; target_agent_id?: string; tool_name?: string; input: any; summary?: string; kb_ids?: string[]; query?: string }> {
    const db = this.env.DB;
    // 使用原版的 system_prompt 字段以防命名冲突
    const agentsListText = agents.map(a => `- 智能体ID: "${a.id}", 角色: "${a.role}", 名称: "${a.name}", 系统提示词: "${a.system_prompt.slice(0, 100)}..."`).join("\n");
    const toolDefs = ToolRegistry.getToolDefinitions();

    // 只显示与当前智能体工具配置相关的工具 + 最多额外显示 5 个
    const agentToolNames = new Set<string>();
    agents.forEach(a => {
      try {
        const tools = JSON.parse(a.tools);
        if (Array.isArray(tools)) tools.forEach((t: string) => agentToolNames.add(t));
      } catch {}
    });

    const prioritizedDefs = toolDefs.filter(t => agentToolNames.has(t.name));
    const otherDefs = toolDefs.filter(t => !agentToolNames.has(t.name)).slice(0, 5);
    const displayDefs = [...prioritizedDefs, ...otherDefs];

    const toolListText = displayDefs.length > 0
      ? displayDefs.map(t => {
          const shortDesc = t.description.split(/[。\n]/).filter((s: string) => s.trim())[0]?.trim().slice(0, 80) || t.description.slice(0, 80);
          return `- "${t.name}" (${shortDesc}${shortDesc.length >= 80 ? "..." : ""})\n` +
          t.parameters.map((p: any) =>
            `  - "${p.name}" (${p.type}${p.required ? ", 必填" : ", 可选"}): ${p.description.split(/[。\n]/)[0]?.trim().slice(0, 60) || p.description.slice(0, 60)}`
          ).join("\n");
        }).join("\n\n")
      : "(当前无可用系统工具)";
    let systemPromptTemplate = "";
    try {
      systemPromptTemplate = await PromptManager.getPrompt(db, this.env.CACHE_KV, WorkflowConstants.PROMPT_KEY_SUPERVISOR);
    } catch (err: unknown) {
      TraceLogger.warn("WORKFLOW", "PROMPT_LOAD_FALLBACK", taskId, `加载系统决策 Prompt 异常，启动本地硬编码兜底: ${err instanceof Error ? err.message : String(err)}`);
      systemPromptTemplate = WorkflowConstants.DEFAULT_SUPERVISOR_PROMPT_TEMPLATE;
    }

    const systemPrompt = systemPromptTemplate
      .replace("{{goal}}", goal)
      .replace("{{agents_list}}", agentsListText)
      .replace("{{tools_list}}", toolListText);

    const messages = [
      { role: "system", content: systemPrompt },
      ...memory.slice(-6), // 仅保留最近的 6 轮历史会话防溢出
      { role: "user", content: "请根据当前执行进度做出决策。" }
    ];

    if (!this.env.AI) {
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_WARN as any, "[主控] AI 模型未绑定，切换为本地规则模式");
      return this.mockSupervisorDecision(memory, agents);
    }

    await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 正在进行 AI 决策推理...`);
    try {
      const responseText = await callLlmChatAndLog(this.env.AI, db, taskId, "主控协调官", messages, undefined, undefined, undefined, this.env.LOG_QUEUE);
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] AI 原始响应: ${responseText.slice(0, 500)}`);
      const decision = safeParseJSON(responseText);
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] AI 决策完成，动作: ${decision.action}`);
      if (decision.action === "ROUTE_TO_AGENT") {
        const routeAgent = agents.find((a) => a.id === decision.target_agent_id);
        if (routeAgent && routeAgent.tools && routeAgent.tools !== "[]") {
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_WARN as any, `[主控] ⚠️ ${routeAgent.name} 配置了工具 ${routeAgent.tools} 但本轮直接路由给它（未提前 CALL_TOOL），Agent 将无法获取真实数据`);
        }
      }
      return decision;
    } catch (e: unknown) {
      TraceLogger.warn("WORKFLOW", "SUPERVISOR_FALLBACK", "SYSTEM", `Supervisor 推理发生异常，触发规则链条兜底: ${getErrorMessage(e)}`);
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_WARN as any, `[主控] AI 决策异常: ${getErrorMessage(e)}，使用本地规则兜底`);
      return this.mockSupervisorDecision(memory, agents);
    }
  }

  /**
   * Supervisor 本地硬编码 Mock 规划，保障离线或无 AI 绑定时的运行韧性
   */
  public mockSupervisorDecision(memory: Array<{ role: string; content: string }>, agents: AgentRow[]): any {
    const agentCalls = memory.filter((m) => m.role === "user" && m.content.includes("【"));
    const callCount = agentCalls.length;

    const toolAgent = agents.find((a) => a.tools && a.tools !== "[]");
    if (callCount === 0 && toolAgent) {
      const parsedTools = JSON.parse(toolAgent.tools);
      if (parsedTools.includes("weather_query")) {
        return { thought: "第一步，调用天气查询工具获取实时数据...", action: "CALL_TOOL", tool_name: "weather_query", input: { city: "北京" } };
      }
      if (parsedTools.includes("web_fetch")) {
        return { thought: "第一步，调度网页抓取工具获取最新数据...", action: "CALL_TOOL", tool_name: "web_fetch", input: "http://example.com" };
      }
    }
    const collector = agents.find((a) => a.id.includes("collector")) || agents[0];
    const analyst = agents.find((a) => a.id.includes("analyst")) || agents[1] || agents[0];
    const notifier = agents.find((a) => a.id.includes("notifier")) || agents[2] || agents[0];

    if (callCount === 0) {
      return {
        thought: "第一步，调度网络抓取专家抓取最新数据...",
        action: "ROUTE_TO_AGENT",
        target_agent_id: collector.id,
        input: "抓取 http://example.com 获取当前行业的前沿数据"
      };
    }
    
    if (callCount === 1) {
      return {
        thought: "抓取完毕，将得到的内容移交给分析专家进行商业分析...",
        action: "ROUTE_TO_AGENT",
        target_agent_id: analyst.id,
        input: "请对上一步的抓取成果进行提纲挈领的行业剖析并给出分析报告"
      };
    }

    if (callCount === 2) {
      return {
        thought: "分析完毕，现在交由邮件官撰写并向用户投递通知信件...",
        action: "ROUTE_TO_AGENT",
        target_agent_id: notifier.id,
        input: "将分析师得出的行业剖析整理发件发给用户"
      };
    }

    return {
      thought: "邮件已全量投递，协同流程整体终结。",
      action: "FINISH",
      summary: "已成功执行多智能体联动编排：[网页采集专家] -> [深度分析师] -> [邮件通知官] 流程，并将报告推送至用户信箱。"
    };
  }
}
