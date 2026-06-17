# 架构决策记录 (ADR)：边缘智能体协同编排系统 (Edge Agent Orchestrator)

## 1. 架构定位 (Architectural Position)

本项目目前为基于 Cloudflare Workers & D1 & Workflows 基础设施的慢任务执行系统，包含 `gateway`、`admin` 和 `workflow` 三个微服务。当前仅支持硬编码的 `PRICE_MONITOR` (比价监控) 与 `CONTENT_DAILY` (每日快报) 两种原子任务流，无法做到动态多智能体规划和自主决策。

### 1.1 架构升级定位
为了将其优化为目前主流的 **多 Agent 协同与编排系统**，我们将基于以下架构原则进行重构：
1. **解除硬编码 (Decoupling)**：弃用硬编码的任务执行序列，升级为 **Supervisor-Workers (主控-子智能体) 模式** 的通用边缘编排引擎。
2. **微服务定位分工**：
   - **`swarm-gateway`**：处理鉴权、用户请求、自定义 Agent 创建以及任务发布。
   - **`swarm-workflow` (通用编排引擎)**：作为 Cloudflare Workflows 的执行载体。在启动时，根据用户提交的“编排目标 (Goal)”与指定的“协作智能体集合 (Agents)”，拉起一个 Supervisor (主控 Agent)。由 Supervisor 负责分析上下文，并通过大模型推理动态做路由规划 (ReAct 循环)，决定由哪个专业领域的子 Agent 发言或调用何种工具 (Tool)，实现最终的任务聚合。
3. **数据解耦 (Data Decoupling)**：新增专门的 `agents` 实体表以存储智能体的 Prompt 词、绑定 Tools 属性等，使得智能体定义和任务执行实例完全隔离。

### 1.2 外部依赖与工具集 (Tools)
支持注册并让智能体调用的内置边缘级微工具 (Edge Micro-Tools)：
- `web_fetch`：利用 Cloudflare 边缘的 `fetch` 去抓取目标网页数据并解析核心文本（模拟网页采集）。
- `email_notify`：使用模拟邮件通知服务（未来可对接 Resend 等）通知用户。
- `llm_refinement`：使用 Cloudflare AI 的 LLM 模型进行数据清洗或格式转换。

---

## 2. 核心契约 (Contracts)

### 2.1 数据库 Schema 修改 (D1 DDL)

#### [NEW] `agents` 表 (智能体定义表)
用于存储系统内置的或者用户自定义的智能体角色、系统 Prompt 与支持的工具。
```sql
CREATE TABLE IF NOT EXISTS agents (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id         TEXT REFERENCES users(id),                  -- 谁创建的，系统内置预设可为 NULL
  name            TEXT NOT NULL,                              -- 智能体名称
  avatar          TEXT NOT NULL DEFAULT '🤖',                 -- 智能体头像 (Emoji)
  role            TEXT NOT NULL,                              -- 角色描述 (比如：市场调研员)
  system_prompt   TEXT NOT NULL,                              -- 系统提示词 (System Prompt)
  model           TEXT NOT NULL DEFAULT '@cf/meta/llama-3-8b-instruct', -- 推理所用大模型
  tools           TEXT NOT NULL DEFAULT '[]',                 -- 绑定的工具列表，JSON String 数组, 例如: '["web_fetch", "email_notify"]'
  is_preset       INTEGER NOT NULL DEFAULT 0,                 -- 1=系统预设, 0=用户自定义
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
```

#### [MODIFY] `tasks` 表
扩充任务类型的字段约束。修改 `task_type` CHECK 约束，增加 `AGENT_ORCHESTRATION` 类型支持。
```sql
-- 在 D1 中修改 CHECK 约束。我们需要重新建 tasks 表，或者在应用层和 DDL 中扩充定义：
-- task_type CHECK(task_type IN ('PRICE_MONITOR', 'CONTENT_DAILY', 'AGENT_ORCHESTRATION'))
```

---

### 2.2 前后端 TypeScript 接口契约
所有类型契约放置在共享依赖包 `backend/packages/shared/src/types.ts`。

```typescript
// 扩展 TaskType
export type TaskType = 'PRICE_MONITOR' | 'CONTENT_DAILY' | 'AGENT_ORCHESTRATION';

// 智能体定义实体
export interface AgentRow {
  id: string;
  user_id: string | null;
  name: string;
  avatar: string;
  role: string;
  system_prompt: string;
  model: string;
  tools: string; // 数据库保存的 JSON string 数组
  is_preset: number; // 0=自定义, 1=系统预设
  created_at: string;
  updated_at: string;
}

// 智能体传输对象
export interface AgentDTO {
  id: string;
  userId: string | null;
  name: string;
  avatar: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

// 创建智能体请求 DTO
export interface CreateAgentReq {
  name: string;
  avatar: string;
  role: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}

// 编排任务 Payload 契约
export interface AgentOrchestrationPayload {
  workflowName: string;                     // 任务/工作流名称
  goal: string;                             // 本次编排核心目标 Prompt (例如: "抓取 Apple 官网最新闻并翻译发送到我邮箱")
  agents: Array<{
    agentId: string;                        // 参与协作的智能体 ID
    roleDescription?: string;               // 临时微调职责（可选）
  }>;
  maxLoops?: number;                        // 最大协同轮数（防死循环）
  email?: string;                           // 用户通知邮箱 (通知 Tool 选用)
}
```

---

## 3. 控制流转与设计模式 (Control Flow & Design Patterns)

系统采用 **中心化 Supervisor-Workers 协同模式**，以 **ReAct (Reasoning and Acting)** 作为核心思考循环。

### 3.1 核心 Supervisor 决策提示词模板 (System Prompt)
Supervisor 本质上是一个强 Prompt 指引的决策大脑。大模型必须严格输出结构化 JSON：
```text
你是一个多智能体协同系统的“主控协调官 (Supervisor)”。你的目标是协同多个子智能体共同完成用户输入的目标。
用户目标: ${goal}
参与协作的智能体列表:
${agents_list_and_description}

你可以采取以下动作（且必须输出以下 JSON 格式）：
1. 派发给子智能体分析 (action = "ROUTE_TO_AGENT")
{
  "thought": "智能体A有网页数据，但还未分析，我需要指派给智能体B（行业分析师）。",
  "action": "ROUTE_TO_AGENT",
  "target_agent_id": "xxx",
  "input": "请对以下网页内容进行行业痛点分析..."
}
2. 调度执行边缘微工具 (action = "CALL_TOOL")
{
  "thought": "我们已经得到了分析报告，我需要发送给用户邮箱。",
  "action": "CALL_TOOL",
  "tool_name": "email_notify",
  "input": { "email": "user@example.com", "subject": "行业报告", "content": "..." }
}
3. 完成任务 (action = "FINISH")
{
  "thought": "目标内容已全部分析完毕并成功发信，任务已经全部完成。",
  "action": "FINISH",
  "summary": "协同链条已完整执行：抓取数据 -> 分析痛点 -> 邮件归档。"
}

注意：你必须严格遵循 JSON 格式，不要返回任何 Markdown 标记或多余文字。
```

---

## 4. 防御设计与异常降级策略 (Defensive Design)

### 4.1 异常场景 1：大模型决策输出格式损坏 (JSON Parse Exception)
- **风险**：大模型没有返回合法 JSON 格式，或者携带了 ` ```json ` 等 Markdown 块，导致解析崩溃。
- **降级/兜底策略**：
  1. **预处理清洗**：正则匹配提取 `{ ... }` 的最外层大括号内容。
  2. **格式降级兜底**：若解析仍然失败，启动预设硬编码规则链条。如：根据已执行轮次，前1-2轮强制执行 `ROUTE_TO_AGENT` 给列表中的第一个 Agent，最后一轮若出错强制以 `FINISH` 退出，且记录 WARN 级别日志并透传 TraceID。

### 4.2 异常场景 2：子智能体协同陷入死循环 (Agent Hallucination Loop)
- **风险**：两个智能体由于提示词冲突，互推责任或进行相同的废话确认，导致不断循环消耗 Token。
- **降级/兜底策略**：
  - 严格限制 `maxLoops`（默认 5 次，最大 8 次）。一旦循环达到限额，自动向日志追加一条 ERROR 日志，置状态为 `FAILED`，并强制释放 D1 事务连接。

### 4.3 异常场景 3：外部工具网络异常/超时 (Network Failure on Tools)
- **风险**：`web_fetch` 遭遇高延迟或反爬拒绝，返回空数据或 503 报错，导致整个工作流中断。
- **降级/兜底策略**：
  - 工具调用加入超时控制 (Timeout: 10s)，并包裹 `try-catch`。
  - 将捕获 of 错误转化为系统异常报告（System Message）追加到大模型 Memory 中（例如：“[System] 工具 web_fetch 调用失败，服务器返回 403 拒绝访问”），让 Supervisor 智能体自己识别到网络受限，从而决定跳过该步骤、更换 URL 还是直接降级退出。
