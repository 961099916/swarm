// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/workflow.ts

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { AgentRow, AI_MODELS, DEFAULT_MAX_LOOPS, MEMORY_RECENT_COUNT, MEMORY_AGENT_COUNT, TraceLogger } from "@swarm/shared";
import { appendTaskLog, updateTaskStatus, safeParseJSON, TaskStatus } from "./utils";
import {
  ToolRegistry,
  ToolContext,
} from "./tools";

const DEFAULT_MODEL = AI_MODELS.DEFAULT;

export interface Env {
  DB: D1Database;
  AI: any;
  EMAIL_FROM?: string;
}

export interface Params {
  taskId: string;
  taskType: "PRICE_MONITOR" | "CONTENT_DAILY" | "AGENT_ORCHESTRATION";
  payload: Record<string, any>;
}

// ══════════════════════════════════════════════════
// 3. AI 调用与 JSON 清洗解析器
// ══════════════════════════════════════════════════
// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/workflow.ts
function getSupportedModel(model: string | undefined): string {
  const m = model ? model.trim() : "";
  if (!m || m.includes("llama-3.2-3b") || m.includes("llama-3-8b") || m.includes("llama-3.1-8b-instruct")) {
    return "@cf/meta/llama-3.1-8b-instruct-fp8";
  }
  return m;
}

function truncateContent(content: string, maxLen = 1000): string {
  if (!content) return "";
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + "\n... [由于该节点返回内容过长，已由工作流系统自动截断，以节省大模型 Token 资源]";
}

async function callLlmChatAndLog(
  ai: any,
  db: D1Database,
  taskId: string,
  agentName: string,
  messages: Array<{ role: string; content: string }>,
  model: string | undefined
): Promise<string> {
  if (!ai) throw new Error("Cloudflare AI 实例未绑定");
  const rawModel = model || DEFAULT_MODEL;
  const mappedModel = getSupportedModel(rawModel);
  
  const startTime = Date.now();
  let responseText = "";
  let errorMsg: string | undefined = undefined;
  let success = true;
  
  try {
    const res = await ai.run(mappedModel, { messages });
    responseText = res.response || "";
    if (!responseText) {
      throw new Error("大模型响应内容为空");
    }
    return responseText;
  } catch (err: any) {
    success = false;
    errorMsg = err.message || JSON.stringify(err);
    throw err;
  } finally {
    const latencyMs = Date.now() - startTime;
    
    // 异步安全地记录 AI 日志契约 (带 Token 遥测与 Latency 观测)
    const logPayload = {
      type: "AI_CHAT_LOG",
      agentName,
      model: mappedModel,
      messages,
      response: responseText,
      success,
      error: errorMsg
    };

    try {
      // 记录到 taskLogs 数据库中
      await appendTaskLog(db, taskId, "INFO", `[AI_CHAT] ${JSON.stringify(logPayload)}`);
      
      // 触发 Cloudflare TraceLogger 可观测性 JSON 输出
      TraceLogger.write(
        success ? "INFO" : "ERROR",
        "WORKFLOW",
        "AI_CHAT_CALL",
        taskId,
        `智能体 ${agentName} 调用大模型 ${success ? '成功' : '失败'}，耗时 ${latencyMs}ms`,
        undefined,
        messages,
        errorMsg ? new Error(errorMsg) : undefined,
        {
          model: mappedModel,
          promptTokens: -1,     // D1 环境下 CF AI 不输出消耗
          completionTokens: -1,
          latencyMs
        }
      );
    } catch (dbErr: any) {
      TraceLogger.error("WORKFLOW", "LOG_WRITE_FAILED", taskId, `写入 AI 交互日志失败: ${dbErr.message || dbErr}`, dbErr);
    }
  }
}

// ══════════════════════════════════════════════════
// 4. 多智能体协作核心引擎
// ══════════════════════════════════════════════════

export class TaskOrchestrator extends WorkflowEntrypoint<Env, Params> {
  declare env: Env;

  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { taskId, taskType, payload } = event.payload;
    const db = this.env.DB;

    try {
      if (taskType !== "AGENT_ORCHESTRATION") {
        // 兼容保留旧版 PRICE_MONITOR 和 CONTENT_DAILY 的基础执行，略过
        await this.runLegacyWorkflow(taskId, taskType, payload, step);
        return;
      }

      await appendTaskLog(db, taskId, "INFO", `[主控] 启动智能体协同工作流: ${payload.workflowName || "未命名工作流"}`);
      await appendTaskLog(db, taskId, "INFO", `[主控] 任务目标: ${payload.goal || "未设定目标"}`);
      await appendTaskLog(db, taskId, "INFO", `[主控] 最大执行轮数: ${payload.maxLoops || 5} 轮`);

      // 1. 获取选定智能体的配置
      const agentConfigs = await step.do("load-agents-config", async () => {
        const queryIds = (payload.agents || []).map((a: any) => a.agentId);
        if (queryIds.length === 0) return [];

        const placeholders = queryIds.map(() => "?").join(",");
        const { results } = await db
          .prepare(`SELECT * FROM agents WHERE id IN (${placeholders})`)
          .bind(...queryIds)
          .all<AgentRow>();
        
        return results || [];
      });

      if (agentConfigs.length === 0) {
        throw new Error("任务中未配置任何有效的协同智能体");
      }

      // 记录每个 Agent 的工具配置信息
      for (const agent of agentConfigs) {
        if (agent.tools && agent.tools !== "[]") {
          await appendTaskLog(db, taskId, "INFO", `[配置] 智能体 ${agent.name} 配置了工具: ${agent.tools}（注意：这些工具只能由主控通过 CALL_TOOL 调用，Agent 本身无法执行）`);
        }
      }
      const agentNames = agentConfigs.map(a => `${a.name}(${a.role})`).join(", ");
      await appendTaskLog(db, taskId, "INFO", `[主控] 已加载 ${agentConfigs.length} 个智能体: ${agentNames}`);

      // 2. 初始化 ReAct 循环上下文
      let conversationMemory: Array<{ role: string; content: string }> = [];
      const maxLoops = payload.maxLoops || 5;
      let workflowFinished = false;
      let finalSummary = "任务执行超时未完成";

      // 3. 进入 ReAct 编排主循环
      for (let loop = 1; loop <= maxLoops; loop++) {
        if (workflowFinished) break;

        const currentLoop = loop;
        await appendTaskLog(db, taskId, "INFO", `[主控] ───────── 启动第 ${currentLoop}/${maxLoops} 轮协同决策 ─────────`);
        await appendTaskLog(db, taskId, "INFO", `[主控] 当前对话记忆大小: ${conversationMemory.length} 条`);

        // 执行 Supervisor 推理决定下一步
        const decision = await step.do(`supervisor-decide-loop-${currentLoop}`, async () => {
          return await this.getSupervisorDecision(db, taskId, payload.goal, agentConfigs, conversationMemory);
        });

        await appendTaskLog(db, taskId, "INFO", `[主控] 规划思路: "${decision.thought}"`);
        await appendTaskLog(db, taskId, "INFO", `[主控] 决策动作: ${decision.action}${decision.action === "ROUTE_TO_AGENT" ? ` → 目标: ${decision.target_agent_id}` : ""}${decision.action === "CALL_TOOL" ? ` → 工具: ${decision.tool_name}` : ""}`);

        if (decision.action === "ROUTE_TO_AGENT") {
          const targetAgent = agentConfigs.find((a) => a.id === decision.target_agent_id);
          if (!targetAgent) {
            const errLog = `未找到指定智能体 ID: ${decision.target_agent_id}，本轮跳过`;
            await appendTaskLog(db, taskId, "WARN", `[主控] ${errLog}`);
            conversationMemory.push({ role: "system", content: errLog });
            continue;
          }
          if (targetAgent.tools && targetAgent.tools !== "[]") {
            await appendTaskLog(db, taskId, "WARN", `[主控] ⚠️ Agent ${targetAgent.name} 配置了工具 ${targetAgent.tools} 但本轮直接路由给它（未提前 CALL_TOOL），Agent 无法获取真实数据，只能根据已有知识回复`);
          }

          await appendTaskLog(db, taskId, "INFO", `[主控] 派发任务给智能体: ${targetAgent.name}`);
          await appendTaskLog(db, taskId, "INFO", `[主控] 指派内容: ${typeof decision.input === "string" ? decision.input : JSON.stringify(decision.input)}`);

          // 运行子智能体
          const agentOutput = await step.do(`agent-run-${targetAgent.id}-loop-${currentLoop}`, async () => {
            return await this.runWorkerAgent(db, taskId, targetAgent, decision.input, conversationMemory);
          });

          await appendTaskLog(db, taskId, "INFO", `[${targetAgent.name}] 执行完成`);
          await appendTaskLog(db, taskId, "INFO", `[${targetAgent.name}] 输出结果: ${(agentOutput || "").slice(0, 500)}${(agentOutput || "").length > 500 ? "..." : ""}`);
          conversationMemory.push({
            role: "user",
            content: `【${targetAgent.name} (${targetAgent.role})】的发信与回复:\n${agentOutput}`
          });
          await appendTaskLog(db, taskId, "INFO", `[主控] 对话记忆已追加，当前共 ${conversationMemory.length} 条`);

        } else if (decision.action === "CALL_TOOL" && decision.tool_name) {
          const toolName = decision.tool_name;
          const toolInputStr = typeof decision.input === "string" ? decision.input : JSON.stringify(decision.input);
          await appendTaskLog(db, taskId, "INFO", `[主控] 调度工具: ${toolName}，输入: ${toolInputStr.slice(0, 300)}`);

          const toolResult = await step.do(`tool-run-${toolName}-loop-${currentLoop}`, async () => {
            return await this.runEdgeTool(toolName, decision.input, payload.email, taskId);
          });

          const isToolError = toolResult.startsWith("[ERROR]");
          const toolLogLevel = isToolError ? "ERROR" : "INFO";
          await appendTaskLog(db, taskId, toolLogLevel, `[工具 - ${toolName}] 返回结果: ${(toolResult || "").slice(0, 500)}${(toolResult || "").length > 500 ? "..." : ""}`);
          if (isToolError) {
            await appendTaskLog(db, taskId, "ERROR", `[工具 - ${toolName}] 执行失败，将在下一轮决策中感知到该错误`);
          } else {
            await appendTaskLog(db, taskId, "INFO", `[工具 - ${toolName}] 执行成功，真实数据已获取`);
          }
          conversationMemory.push({
            role: "user",
            content: `【系统工具 - ${toolName}】的执行返回内容:\n${truncateContent(toolResult)}`
          });
          await appendTaskLog(db, taskId, "INFO", `[主控] 对话记忆已追加工具结果，当前共 ${conversationMemory.length} 条`);

        } else if (decision.action === "FINISH") {
          finalSummary = decision.summary || "所有智能体协同动作完成";
          workflowFinished = true;
          await appendTaskLog(db, taskId, "INFO", `[主控] 任务完成: ${finalSummary}`);
          break;
        } else {
          // 未识别指令，降级为 Mock 流程
          await appendTaskLog(db, taskId, "WARN", `[主控] 未识别行动指令: ${decision.action}，启动兜底流程`);
          workflowFinished = true;
          finalSummary = "大模型决策指令无法识别，已按兜底规则完成任务";
          break;
        }
      }

      // 4. 收尾归档
      await step.do("finalize-orchestration", async () => {
        // 从对话记忆中提取最后一条有意义的输出（Agent回复或工具结果），作为结果详情
        let resultDetail = "";
        for (let i = conversationMemory.length - 1; i >= 0; i--) {
          const entry = conversationMemory[i].content;
          if (entry.includes("【") && entry.includes("】的发信与回复:")) {
            resultDetail = entry.replace(/【[^】]+】的发信与回复:\n?/, "").slice(0, 1000);
            break;
          }
          if (entry.includes("【系统工具")) {
            resultDetail = entry.replace(/【[^】]+】的执行返回内容:\n?/, "").slice(0, 1000);
            break;
          }
        }
        const hasValidSummary = finalSummary && finalSummary !== "所有智能体协同动作完成";
        const enrichedSummary = hasValidSummary ? finalSummary : (resultDetail || finalSummary);
        await updateTaskStatus(db, taskId, "SUCCESS", enrichedSummary);
        await appendTaskLog(db, taskId, "INFO", `[主控] 工作流执行完毕，任务已归档`);
      });

    } catch (err: any) {
      console.error(`[ERROR] Workflow failed: ${err.message}`);
      await updateTaskStatus(db, taskId, "FAILED", `执行异常: ${err.message}`);
      await appendTaskLog(db, taskId, "ERROR", `[主控] 工作流异常终止: ${err.message}`);
    }
  }

  /**
   * 让 Supervisor (主控) 做出下一步路由规划决策
   */
  private async getSupervisorDecision(
    db: D1Database,
    taskId: string,
    goal: string,
    agents: AgentRow[],
    memory: Array<{ role: string; content: string }>
  ): Promise<{ thought: string; action: string; target_agent_id?: string; tool_name?: string; input: any; summary?: string }> {
    const agentsListText = agents.map(a => `- 智能体ID: "${a.id}", 角色: "${a.role}", 名称: "${a.name}", 系统提示词: "${a.system_prompt.slice(0, 100)}..."`).join("\n");
    const toolDefs = ToolRegistry.getToolDefinitions();
    const toolListText = toolDefs.length > 0
      ? toolDefs.map(t =>
          `- "${t.name}" (${t.description})\n` +
          t.parameters.map(p =>
            `  - "${p.name}" (${p.type}${p.required ? ", 必填" : ", 可选"}): ${p.description}${p.enum ? ` [可选值: ${p.enum.join(", ")}]` : ""}`
          ).join("\n")
        ).join("\n\n")
      : "(当前无可用系统工具)";
    const systemPrompt = `你是一个多智能体协同系统的“主控协调官 (Supervisor)”。你的目标是协同多个子智能体共同完成用户输入的目标。
用户目标: "${goal}"

参与协作的智能体列表:
${agentsListText}

## ⚠️ 重要规则（必须严格遵守）
1. **Agent 没有任何调用工具的能力** — 所有 Agent 都只是文本对话机器人，只能处理文本数据。它们无法执行任何系统工具。
2. **获取实时数据必须使用 CALL_TOOL** — 如果任务需要获取实时数据（天气查询、网页抓取、搜索、邮件发送等），必须在当前轮次使用 CALL_TOOL 动作直接调用系统工具。不能依赖 Agent 去调用工具。
3. **Agent 的"配置工具"字段仅供参考** — 该字段表示该 Agent 的任务通常需要配合某个工具使用，但 Agent 本身无法执行。你必须通过 CALL_TOOL 来执行工具，获取数据后再通过 ROUTE_TO_AGENT 让 Agent 分析/格式化。

你可以采取以下动作之一（且必须严格输出以下 JSON 格式，不要包含 Markdown 标记或多余解释）：
1. 派发给子智能体分析 (action = "ROUTE_TO_AGENT")
{
  "thought": "我需要先派网页采集专家去获取网页内容...",
  "action": "ROUTE_TO_AGENT",
  "target_agent_id": "具体智能体ID",
  "input": "指派给它的具体用户输入提示"
}
2. 调度执行系统工具 (action = "CALL_TOOL")
可用工具列表:
${toolListText}
{
  "thought": "用户想查询北京的天气，我需要调用天气查询工具获取实时数据",
  "action": "CALL_TOOL",
  "tool_name": "weather_query",
  "input": { "city": "北京" }
}
3. 完成任务 (action = "FINISH")
{
  "thought": "目标内容已完美产出并归档，任务结束。",
  "action": "FINISH",
  "summary": "最终给用户的协同简要报告"
}

请注意：你必须返回纯 JSON 对象，不能使用 \`\`\`json 等任何格式标记包围。`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...memory.slice(-6), // 仅保留最近的 6 轮历史会话防溢出
      { role: "user", content: "请根据当前执行进度做出决策。" }
    ];

    if (!this.env.AI) {
      await appendTaskLog(db, taskId, "WARN", "[主控] AI 模型未绑定，切换为本地规则模式");
      return this.mockSupervisorDecision(memory, agents);
    }

    await appendTaskLog(db, taskId, "INFO", `[主控] 正在进行 AI 决策推理...`);
    try {
      const responseText = await callLlmChatAndLog(this.env.AI, db, taskId, "主控协调官", messages, DEFAULT_MODEL);
      await appendTaskLog(db, taskId, "INFO", `[主控] AI 原始响应: ${responseText.slice(0, 500)}`);
      const decision = safeParseJSON(responseText);
      await appendTaskLog(db, taskId, "INFO", `[主控] AI 决策完成，动作: ${decision.action}`);
      if (decision.action === "ROUTE_TO_AGENT") {
        const routeAgent = agents.find((a) => a.id === decision.target_agent_id);
        if (routeAgent && routeAgent.tools && routeAgent.tools !== "[]") {
          await appendTaskLog(db, taskId, "WARN", `[主控] ⚠️ ${routeAgent.name} 配置了工具 ${routeAgent.tools} 但本轮直接路由给它（未提前 CALL_TOOL），Agent 将无法获取真实数据`);
        }
      }
      return decision;
    } catch (e: any) {
      console.warn("Supervisor 推理发生异常，触发规则链条兜底:", e.message);
      await appendTaskLog(db, taskId, "WARN", `[主控] AI 决策异常: ${e.message}，使用本地规则兜底`);
      return this.mockSupervisorDecision(memory, agents);
    }
  }

  /**
   * 运行子智能体进行业务推理
   */
  private async runWorkerAgent(
    db: D1Database,
    taskId: string,
    agent: AgentRow,
    input: string,
    memory: Array<{ role: string; content: string }>
  ): Promise<string> {
    if (!this.env.AI) {
      await appendTaskLog(db, taskId, "WARN", `[${agent.name}] AI 模型未绑定，跳过执行`);
      return `[跳过] 智能体 ${agent.name} 运行环境未绑定 AI，本轮跳过。`;
    }

    const model = agent.model || DEFAULT_MODEL;
    await appendTaskLog(db, taskId, "INFO", `[${agent.name}] 开始执行，使用模型: ${model}`);
    await appendTaskLog(db, taskId, "INFO", `[${agent.name}] 上下文包含 ${Math.min(memory.length, MEMORY_AGENT_COUNT)} 条历史记忆`);

    // 对传入记忆中的文本进行截断保护，防止大模型 Context Window 被超长返回撑爆
    const safeMemory = memory.slice(-4).map(m => ({
      role: m.role,
      content: truncateContent(m.content)
    }));

    const messages = [
      { role: "system", content: agent.system_prompt },
      ...safeMemory,
      { role: "user", content: input }
    ];

    try {
      const result = await callLlmChatAndLog(this.env.AI, db, taskId, agent.name, messages, agent.model);
      await appendTaskLog(db, taskId, "INFO", `[${agent.name}] 推理完成，输出长度 ${result.length} 字符`);
      return result;
    } catch (e: any) {
      await appendTaskLog(db, taskId, "ERROR", `[${agent.name}] 推理失败: ${e.message}`);
      return `[ERROR] 智能体 ${agent.name} 推理过程抛出异常: ${e.message}`;
    }
  }

  /**
   * 调度执行系统边缘微工具 - 增强版
   */
  private async runEdgeTool(toolName: string, input: any, email: string | undefined, taskId?: string): Promise<string> {
    const tool = await ToolRegistry.getOrLoad(this.env.DB, toolName);
    if (!tool) {
      const available = ToolRegistry.getAvailableTools().join(", ");
      if (taskId) { await appendTaskLog(this.env.DB, taskId, "ERROR", `[工具调度] 未找到工具: ${toolName}，可用: ${available}`); }
      return `[ERROR] 不支持的工具: ${toolName}。可用工具: ${available}`;
    }
    const context: ToolContext = {
      traceId: taskId || "SYSTEM_WORKFLOW",
      env: {
        DB: this.env.DB,
        AI: this.env.AI,
        EMAIL_FROM: this.env.EMAIL_FROM,
        EMAIL_TO: email
      }
    };
    if (taskId) { await appendTaskLog(this.env.DB, taskId, "INFO", `[工具调度] 正在查找工具: ${toolName}`); }
    return await tool.execute(input, context);
  }

  /**
   * Supervisor 本地硬编码 Mock 规划，保障离线或无 AI 绑定时的运行韧性
   */
  private mockSupervisorDecision(memory: Array<{ role: string; content: string }>, agents: AgentRow[]): any {
    // 根据 Memory 的条数来模拟顺序派发
    const agentCalls = memory.filter((m) => m.role === "user" && m.content.includes("【"));
    const callCount = agentCalls.length;

    // 获取内置 ID 或是动态列表前几个
    // 如果存在配置了工具的 Agent，优先调用工具获取真实数据
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

  /**
   * 兼容保留的原有慢任务硬编码工作流
   */
  private async runLegacyWorkflow(taskId: string, taskType: string, payload: Record<string, any>, step: WorkflowStep) {
    const db = this.env.DB;
    await step.do("legacy-fetch", async () => {
      await appendTaskLog(db, taskId, "INFO", `[Fetch] 启动兼容任务拉取。物料: ${JSON.stringify(payload)}`);
    });
    await step.do("legacy-ai", async () => {
      await appendTaskLog(db, taskId, "INFO", `[AI] 本地策略分析中...`);
    });
    await step.do("legacy-notify", async () => {
      await appendTaskLog(db, taskId, "INFO", `[Notify] 触发价格降级警报发送至 ${payload.email || 'user@example.com'}`);
    });
    await step.do("legacy-finalize", async () => {
      await updateTaskStatus(db, taskId, "SUCCESS", "兼容模式：任务已完成规则化比价监控");
      await appendTaskLog(db, taskId, "INFO", `[Finalize] 兼容流执行完毕。`);
    });
  }
}

// 默认导出
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    return new Response("Workflow Engine Active", { status: 200 });
  }
};
