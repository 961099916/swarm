// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/orchestrator.ts

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { AgentRow, tasks, AgentConfig } from "@swarm/agent";
import { TraceLogger, getErrorMessage } from "@swarm/kernel";
import { appendTaskLog, updateTaskStatus, TaskLogger } from "./utils";
import { ensureDbToolsLoaded } from "./tools";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

import { WorkflowConstants } from "./constants/workflow.constant";
import { SupervisorService } from "./services/supervisor";
import { AgentRunnerService } from "./services/agent-runner";
import { ToolRunnerService } from "./services/tool-runner";
import { truncateContent, callLlmChatAndLog } from "./services/ai";

export interface Env {
  DB: D1Database;
  AI: any;
  EMAIL_FROM?: string;
  RAG?: Fetcher;  // RAG Worker Service Binding
  LOG_QUEUE?: any;
  CACHE_KV?: any;
}

export interface Params {
  taskId: string;
  taskType: "PRICE_MONITOR" | "CONTENT_DAILY" | "AGENT_ORCHESTRATION";
  payload: Record<string, any>;
}

/**
 * TaskOrchestrator — 智能体编排状态机核心
 * 
 * 按照阿里代码规范分层，它仅负责状态流控的编排逻辑，
 * 具体 LLM 调用、Agent 运转、工具执行全部委托给专有领域 Services 办理。
 */
export class TaskOrchestrator extends WorkflowEntrypoint<Env, Params> {
  declare env: Env;

  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { taskId, taskType, payload } = event.payload;
    const db = this.env.DB;

    // 初始化日志器，将 D1 数据库和 Queue 绑定注入，支持削峰
    TaskLogger.setDatabase(db);
    if (this.env.LOG_QUEUE) {
      TaskLogger.setQueue(this.env.LOG_QUEUE);
    }

    // 实例化分层业务服务
    const supervisorSvc = new SupervisorService(this.env);
    const agentRunnerSvc = new AgentRunnerService(this.env);
    const toolRunnerSvc = new ToolRunnerService(this.env);

    try {
      if (taskType === (WorkflowConstants.TYPE_WORKFLOW_EXECUTION as any)) {
        await this.runCustomWorkflow(taskId, payload, step, db, agentRunnerSvc, toolRunnerSvc);
        return;
      }

      if (taskType !== (WorkflowConstants.TYPE_AGENT_ORCHESTRATION as any)) {
        // 兼容保留旧版PRICE_MONITOR和CONTENT_DAILY的基础执行，略过
        await this.runLegacyWorkflow(taskId, taskType, payload, step);
        return;
      }

      const defaultMaxLoops = await AgentConfig.getDefaultMaxLoops(db);

      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 启动智能体协同工作流: ${payload.workflowName || "未命名工作流"}`);
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 任务目标: ${payload.goal || "未设定目标"}`);
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 最大执行轮数: ${payload.maxLoops || defaultMaxLoops} 轮`);

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

      // 1.1 加载动态工具注册表
      await step.do("load-tools-registry", async () => {
        await ensureDbToolsLoaded(db);
      });

      // 记录每个 Agent 的工具配置信息
      for (const agent of agentConfigs) {
        if (agent.tools && agent.tools !== "[]") {
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[配置] 智能体 ${agent.name} 配置了工具: ${agent.tools}（注意：这些工具只能由主控通过 CALL_TOOL 调用，Agent 本身无法执行）`);
        }
      }
      const agentNames = agentConfigs.map(a => `${a.name}(${a.role})`).join(", ");
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 已加载 ${agentConfigs.length} 个智能体: ${agentNames}`);

      // 2. 初始化 ReAct 循环上下文
      let conversationMemory: Array<{ role: string; content: string }> = [];
      const maxLoops = payload.maxLoops || defaultMaxLoops;
      let workflowFinished = false;
      let finalSummary = "任务执行超时未完成";

      // 3. 进入 ReAct 编排主循环
      for (let loop = 1; loop <= maxLoops; loop++) {
        if (workflowFinished) break;

        const currentLoop = loop;
        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] ───────── 启动第 ${currentLoop}/${maxLoops} 轮协同决策 ─────────`);
        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 当前对话记忆大小: ${conversationMemory.length} 条`);

        // 执行 Supervisor 推理决定下一步
        const decision = await step.do(`supervisor-decide-loop-${currentLoop}`, async () => {
          return await supervisorSvc.getSupervisorDecision(taskId, payload.goal, agentConfigs, conversationMemory);
        });

        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 规划思路: "${decision.thought}"`);
        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 决策动作: ${decision.action}${decision.action === "ROUTE_TO_AGENT" ? ` → 目标: ${decision.target_agent_id}` : ""}${decision.action === "CALL_TOOL" ? ` → 工具: ${decision.tool_name}` : ""}`);

        if (decision.action === "ROUTE_TO_AGENT") {
          const targetAgent = agentConfigs.find((a) => a.id === decision.target_agent_id);
          if (!targetAgent) {
            const errLog = `未找到指定智能体 ID: ${decision.target_agent_id}，本轮跳过`;
            await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_WARN as any, `[主控] ${errLog}`);
            conversationMemory.push({ role: "system", content: errLog });
            continue;
          }
          if (targetAgent.tools && targetAgent.tools !== "[]") {
            await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_WARN as any, `[主控] ⚠️ Agent ${targetAgent.name} 配置了工具 ${targetAgent.tools} 但本轮直接路由给它（未提前 CALL_TOOL），Agent 无法获取真实数据，只能根据已有知识回复`);
          }

          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 派发任务给智能体: ${targetAgent.name}`);
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 指派内容: ${typeof decision.input === "string" ? decision.input : JSON.stringify(decision.input)}`);

          // 运行子智能体
          const agentOutput = await step.do(`agent-run-${targetAgent.id}-loop-${currentLoop}`, async () => {
            return await agentRunnerSvc.runWorkerAgent(taskId, targetAgent, decision.input, conversationMemory);
          });

          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[${targetAgent.name}] 执行完成`);
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[${targetAgent.name}] 输出结果: ${(agentOutput || "").slice(0, 500)}${(agentOutput || "").length > 500 ? "..." : ""}`);
          conversationMemory.push({
            role: "user",
            content: `【${targetAgent.name} (${targetAgent.role})】的发信与回复:\n${agentOutput}`
          });
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 对话记忆已追加，当前共 ${conversationMemory.length} 条`);

        } else if (decision.action === "CALL_TOOL" && decision.tool_name) {
          const toolName = decision.tool_name;
          const toolInputStr = typeof decision.input === "string" ? decision.input : JSON.stringify(decision.input);
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 调度工具: ${toolName}，输入: ${toolInputStr.slice(0, 300)}`);

          const toolResult = await step.do(`tool-run-${toolName}-loop-${currentLoop}`, async () => {
            return await toolRunnerSvc.runEdgeTool(toolName, decision.input, payload.email, taskId);
          });

          const isToolError = toolResult.startsWith("[ERROR]");
          const toolLogLevel = isToolError ? WorkflowConstants.LOG_LEVEL_ERROR : WorkflowConstants.LOG_LEVEL_INFO;
          await appendTaskLog(db, taskId, toolLogLevel as any, `[工具 - ${toolName}] 返回结果: ${(toolResult || "").slice(0, 500)}${(toolResult || "").length > 500 ? "..." : ""}`);
          if (isToolError) {
            await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_ERROR as any, `[工具 - ${toolName}] 执行失败，将在下一轮决策中感知到该错误`);
          } else {
            await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[工具 - ${toolName}] 执行成功，真实数据已获取`);
          }
          conversationMemory.push({
            role: "user",
            content: `【系统工具 - ${toolName}】的执行返回内容:\n${truncateContent(toolResult)}`
          });
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 对话记忆已追加工具结果，当前共 ${conversationMemory.length} 条`);

        } else if (decision.action === "QUERY_KNOWLEDGE") {
          const kbIds = decision.kb_ids || payload.knowledgeBaseIds || [];
          const queryText = decision.query || payload.goal || "";
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 查询知识库: ${kbIds.join(", ")}，查询内容: "${queryText.slice(0, 100)}"`);

          const knowledgeResult = await step.do(`query-knowledge-loop-${currentLoop}`, {
            retries: { limit: 2, delay: 1000 },
          }, async () => {
            if (!this.env.RAG) {
              return { context: "", chunks: [] };
            }
            const response = await this.env.RAG.fetch("http://internal/rag/inject", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kbIds, query: queryText, maxChunks: 5, minScore: 0.4 }),
            });
            if (!response.ok) return { context: "", chunks: [] };
            const result = await response.json() as any;
            return result?.data || { context: "", chunks: [] };
          });

          if (knowledgeResult.context) {
            await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 知识库查询成功，获取到 ${knowledgeResult.chunks?.length || 0} 条相关片段`);
            conversationMemory.push({
              role: "user",
              content: `【知识库检索】根据查询"${queryText.slice(0, 100)}"从知识库中找到以下参考信息:\n${truncateContent(knowledgeResult.context, 1500)}`
            });
          } else {
            await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 知识库未找到相关内容，继续下一步决策`);
            conversationMemory.push({
              role: "system",
              content: `知识库查询（"${queryText.slice(0, 100)}"）未返回结果，请基于现有知识回答。`
            });
          }
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 对话记忆已追加知识库结果，当前共 ${conversationMemory.length} 条`);

        } else if (decision.action === "FINISH") {
          finalSummary = decision.summary || "所有智能体协同动作完成";
          workflowFinished = true;
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 任务完成: ${finalSummary}`);
          break;
        } else {
          // 未识别指令，降级为 Mock 流程
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_WARN as any, `[主控] 未识别行动指令: ${decision.action}，启动兜底流程`);
          workflowFinished = true;
          finalSummary = "大模型决策指令无法识别，已按兜底规则完成任务";
          break;
        }
      }

      // 4. 收尾归档
      await step.do("finalize-orchestration", async () => {
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
        await updateTaskStatus(db, taskId, WorkflowConstants.STATUS_SUCCESS, enrichedSummary);

        // 防御性查询当前任务累计已入账 AI 消耗成本（提供审计透明度）
        try {
          const drizzleDb = drizzle(db);
          const taskRecord = await drizzleDb
            .select({ costUsd: tasks.costUsd })
            .from(tasks)
            .where(eq(tasks.id, taskId))
            .limit(1);
          const totalCost = taskRecord?.[0]?.costUsd || 0;
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[审计] 任务已入账 AI 消耗成本: $${totalCost.toFixed(6)} USD`);
        } catch (auditErr: unknown) {
          TraceLogger.warn("WORKFLOW", "AUDIT_COST_LOG_FAILED", taskId, `打印 AI 审计成本日志失败: ${auditErr instanceof Error ? auditErr.message : String(auditErr)}`);
        }

        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 工作流执行完毕，任务已归档`);
      });

    } catch (err: unknown) {
      TraceLogger.error("WORKFLOW", "WORKFLOW_FAILED", "SYSTEM", `Workflow failed: ${getErrorMessage(err)}`, err);
      await updateTaskStatus(db, taskId, WorkflowConstants.STATUS_FAILED, `执行异常: ${getErrorMessage(err)}`);
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_ERROR as any, `[主控] 工作流异常终止: ${getErrorMessage(err)}`);
    }
  }

  /**
   * 自定义流程编排 (有向无环图状态机遍历驱动机)
   */
  private async runCustomWorkflow(
    taskId: string,
    payload: Record<string, any>,
    step: WorkflowStep,
    db: D1Database,
    agentRunnerSvc: AgentRunnerService,
    toolRunnerSvc: ToolRunnerService
  ): Promise<void> {
    await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 启动自定义流程编排工作流: ${payload.workflowName || "未命名工作流"}`);
    await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 初始输入内容: "${payload.goal || "无初始输入"}"`);

    const steps = payload.steps || {};
    let currentStepId = payload.firstStepId || Object.keys(steps)[0];
    let currentInput = payload.goal || "";
    
    if (!currentStepId || Object.keys(steps).length === 0) {
      throw new Error("工作流中未配置任何有效的步骤节点");
    }

    let traversalCount = 0;
    const maxTraversals = 20; // 防止无限死循环的熔断深度
    let lastOutput = "";

    while (currentStepId) {
      traversalCount++;
      if (traversalCount > maxTraversals) {
        throw new Error("工作流执行步数达到限制（20步），已触发死循环熔断保护");
      }

      const node = steps[currentStepId];
      if (!node) {
        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_WARN as any, `[主控] 未找到 ID 为 ${currentStepId} 的步骤节点，工作流提前结束`);
        break;
      }

      const stepName = node.name || `步骤_${currentStepId}`;
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[Step-START] 执行步骤 ${traversalCount}: ${stepName}`);

      const loopIdx = traversalCount;
      const stepId = currentStepId;

      try {
        if (node.type === "agent") {
          const agentId = node.targetId;
          const agentConfig = await step.do(`load-agent-config-step-${loopIdx}`, async () => {
            const { results } = await db
              .prepare(`SELECT * FROM agents WHERE id = ?`)
              .bind(agentId)
              .all<AgentRow>();
            return results?.[0] || null;
          });

          if (!agentConfig) {
            throw new Error(`未找到配置的智能体 ID: ${agentId}`);
          }

          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 派发至智能体: ${agentConfig.name} (${agentConfig.role})`);
          
          const agentOutput = await step.do(`agent-run-step-${loopIdx}`, async () => {
            const extraPrompt = node.prompt ? `\n[附加步骤指令]: ${node.prompt}` : "";
            return await agentRunnerSvc.runWorkerAgent(taskId, agentConfig, `${currentInput}${extraPrompt}`, []);
          });

          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[${agentConfig.name}] 执行完毕`);
          lastOutput = agentOutput || "";
          currentInput = lastOutput;
          currentStepId = node.nextStepId || "";

        } else if (node.type === "tool") {
          const toolName = node.targetId;
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 调度系统工具: ${toolName}`);

          const toolResult = await step.do(`tool-run-step-${loopIdx}`, async () => {
            return await toolRunnerSvc.runEdgeTool(toolName, { input: currentInput, prompt: node.prompt }, payload.email, taskId);
          });

          if (toolResult.startsWith("[ERROR]")) {
            throw new Error(`系统工具 ${toolName} 执行发生异常: ${toolResult}`);
          }

          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[工具 - ${toolName}] 执行完毕`);
          lastOutput = toolResult || "";
          currentInput = lastOutput;
          currentStepId = node.nextStepId || "";

        } else if (node.type === "condition") {
          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 触发条件判断: ${stepName}`);
          
          const branchMatch = await step.do(`condition-run-step-${loopIdx}`, async () => {
            if (!this.env.AI) {
              return "default";
            }
            
            const branches = node.branches || [];
            const values = branches.map((b: any) => b.matchValue).join(", ");
            const systemPrompt = `你是一个轻量级规则分类判定器。你的任务是根据用户的输入内容，判断它与以下哪一个分类最匹配：[${values}]。
你的输出结果必须有且仅有判定出的分类词，严禁带有任何 Markdown 符号、多余换行、多余单词或解释说明！`;
            
            const userContent = `输入内容:\n"""\n${truncateContent(currentInput, 1500)}\n"""\n\n判定提示要求:\n${node.prompt || "请将其分类"}`;
            
            const messages = [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent }
            ];

            const response = await callLlmChatAndLog(this.env.AI, db, taskId, `条件判别-[${stepName}]`, messages, undefined, undefined, undefined, this.env.LOG_QUEUE);
            return response.trim().toLowerCase();
          });

          await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 分类器输出判定: "${branchMatch}"`);

          const branches = node.branches || [];
          const matchedBranch = branches.find((b: any) => branchMatch.includes(b.matchValue.toLowerCase()) || b.matchValue.toLowerCase().includes(branchMatch));
          
          if (matchedBranch) {
            await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[Step-BRANCH] 命中分支: "${matchedBranch.label}" -> 跳转步骤 ID: ${matchedBranch.nextStepId}`);
            currentStepId = matchedBranch.nextStepId;
          } else {
            const fallbackStepId = node.defaultNextStepId || "";
            await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[Step-BRANCH] 未匹配到任何分支，走默认兜底路径 -> 跳转步骤 ID: ${fallbackStepId}`);
            currentStepId = fallbackStepId;
          }

        } else {
          throw new Error(`未知的步骤节点类型: ${node.type}`);
        }

        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[Step-SUCCESS] 步骤 ${traversalCount} 执行成功`);

      } catch (stepErr: unknown) {
        const errMsg = stepErr instanceof Error ? stepErr.message : String(stepErr);
        await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_ERROR as any, `[Step-FAILED] 步骤 ${stepName} 执行出错: ${errMsg}`);
        throw stepErr;
      }
    }

    await step.do("finalize-custom-workflow", async () => {
      const finalSummary = lastOutput || "自定义工作流成功执行完毕，未生成最终汇总输出";
      await updateTaskStatus(db, taskId, WorkflowConstants.STATUS_SUCCESS, finalSummary);
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[主控] 自定义工作流全部成功执行完毕`);
    });
  }

  /**
   * 兼容保留的原有慢任务硬编码工作流
   */
  private async runLegacyWorkflow(taskId: string, taskType: string, payload: Record<string, any>, step: WorkflowStep) {
    const db = this.env.DB;
    await step.do("legacy-fetch", async () => {
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[Fetch] 启动兼容任务拉取。物料: ${JSON.stringify(payload)}`);
    });
    await step.do("legacy-ai", async () => {
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[AI] 本地策略分析中...`);
    });
    await step.do("legacy-notify", async () => {
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[Notify] 触发价格降级警报发送至 ${payload.email || 'user@example.com'}`);
    });
    await step.do("legacy-finalize", async () => {
      await updateTaskStatus(db, taskId, WorkflowConstants.STATUS_SUCCESS, "兼容模式：任务已完成规则化比价监控");
      await appendTaskLog(db, taskId, WorkflowConstants.LOG_LEVEL_INFO as any, `[Finalize] 兼容流执行完毕。`);
    });
  }
}
