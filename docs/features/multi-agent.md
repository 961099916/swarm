# 多智能体编排

## 概述

Swarm 的 Workflow Engine 是一个基于 Cloudflare Workflows 的多 Agent 协同编排系统。它采用 **Supervisor 调度模式**：一个主管 Agent 接收任务，分解为子任务，委派给多个子 Agent 并行执行，最后汇总结果。

## 核心概念

### Workflow

一个 Workflow 代表一次完整的任务执行流程。基于 Cloudflare Workflows 实现，支持长时间运行、自动重试、状态持久化。

### Supervisor Agent

主管 Agent 是整个工作流的调度核心：
1. 接收原始任务输入
2. 分析任务，分解为可执行的子任务
3. 选择合适的子 Agent 并委派任务
4. 收集所有子 Agent 的结果
5. 生成结构化摘要

### Agent

Agent 是具体执行单元，每个 Agent 有独立的：
- **系统提示词** (System Prompt) — 定义 Agent 的角色和行为
- **模型配置** — 使用的 LLM 模型
- **工具列表** — 可调用的工具集

### Tool Registry

动态工具注册表，工具可在运行时从数据库加载。详见 [动态工具注册表](/docs/features/tools-registry.md)。

### 记忆管理

自动管理对话上下文，避免超出 LLM 的 Token 限制：

- `MEMORY_RECENT_COUNT` = 6 — Supervisor 决策保留最近 N 轮记忆
- `MEMORY_AGENT_COUNT` = 4 — Agent 推理保留最近 N 轮上下文
- 超长内容自动截断（1000 字符阈值）

## 工作流执行流程

```
1. 用户创建任务
   │
2. Gateway 校验权限、扣减积分
   │
3. Workflow Engine 启动 Workflow
   │
4. Supervisor Agent 接收任务
   │
5. Supervisor 分析并分解子任务
   │
   ├── Agent A (调用 Tool X)
   ├── Agent B (调用 Tool Y)
   └── Agent C (调用 Tool Z)
   │
6. 收集所有 Agent 结果
   │
7. Supervisor 生成结构化摘要
   │
8. 更新任务状态为 COMPLETED
```

## 代码示例

### 创建工作流

```typescript
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

export class SwarmWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { taskId, taskType, payload } = event.payload;

    // Step 1: 初始化
    const task = await step.do("init", async () => {
      return await initTask(taskId, taskType, payload);
    });

    // Step 2: Supervisor 调度
    const result = await step.do("orchestrate", async () => {
      const supervisor = new SupervisorAgent(ai, db);
      return await supervisor.run(taskId, task.payload, task.agent, task.tools);
    });

    // Step 3: 完成
    await step.do("finalize", async () => {
      await finalizeTask(taskId, result);
    });
  }
}
```

### 创建 Agent

```typescript
const agent = {
  name: "Research Agent",
  systemPrompt: "你是一个研究助手。请使用可用工具查询信息并总结。",
  model: "@cf/meta/llama-3.1-8b-instruct-fp8",
  tools: ["search-web", "web-fetch"],
};
```

## 相关 ADR

- [Agent 编排设计](/docs/design_records/2026-06-15_agent-orchestrator.md)
- [Agent 管理细化](/docs/design_records/2026-06-16_agent-management-refinement.md)
- [工作流可观测性升级](/docs/design_records/2026-06-16_workflow-obs-and-model-upgrade.md)
- [LLaMA 3.2 升级](/docs/design_records/2026-06-16_llama32-upgrade.md)
