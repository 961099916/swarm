# 架构决策记录 (ADR) - AI Gateway 统一网关层

* 创建日期: 2026-06-22
* 状态: 已批准 (Approved, 2026-06-22)
* 作者: 首席全栈架构师

---

## 0. 动机

当前 AI 调用方式存在三个问题：

1. **直连绑定**：`env.AI.run()` 直接调用 Workers AI，无请求日志、无速率限制、无法切换供应商
2. **模型分散**：模型名散落在 `agents` 表的 `model` 字段、`workflow.ts` 常量和工具脚本中，无法全局切换
3. **不可观测**：AI 调用日志通过 `task_logs` 表记录（`[AI_CHAT]` 标记），缺乏聚合分析能力

**目标**：构建统一的 AI Gateway 层，为所有 AI 调用（LLM 推理 + 向量嵌入）提供请求日志、速率限制、动态模型路由和可观测分析。

---

## 1. 架构定位

- **模块归属**: 新增 `backend/packages/shared/src/ai-gateway.ts`（共享 AI 客户端）+ `agents` 表扩展 + `model_configs` 配置表
- **职责**: 
  - 封装所有 AI 供应商的调用，统一出入口
  - 通过 Cloudflare AI Gateway 代理请求，获取内置的日志/缓存/限流
  - 提供运行时动态模型切换能力（不改代码，改 DB 配置即可）
  - 全链路记录 AI 调用日志到 D1（用于自定义分析和计费）
- **外部依赖**:
  - Cloudflare **AI Gateway** binding（代替原生 `[ai]` binding）
  - Cloudflare **D1** — 模型配置持久化
  - Cloudflare **KV** — 模型配置缓存
- **不影响**:
  - 智能体的 system prompt / tool 配置不变
  - 已有 `workflow.ts` 的 ReAct 编排逻辑不变

---

## 2. 整体架构

### 2.1 调用链路对比

```
【改造前】
Agent / 工具 → env.AI.run(model, messages) → Workers AI

【改造后】
Agent / 工具 → AIClient.chat(model, messages)
                  ↓
           AI Gateway (日志/缓存/限流/多Provider)
                  ↓
           Workers AI / OpenAI / Anthropic ...

                  ↓
           D1 ai_call_logs (自定义分析)
```

### 2.2 模块分层

```
┌─────────────────────────────────────────────┐
│              应用层 (workflow.ts)             │
│  callLlmChatAndLog() → AIClient.chat()      │
│  Embedder → AIClient.embed()                │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│         AIClient (packages/shared)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ 路由选择  │ │ 请求发送  │ │ 日志记录     │ │
│  │ 读model  │ │ AI GW    │ │ D1 + KV     │ │
│  │ _configs │ │ fetch    │ │ 速率统计     │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│         Cloudflare AI Gateway               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ 请求日志  │ │ 速率限制  │ │ 响应缓存     │ │
│  │ 全量记录  │ │ 配额控制  │ │ 重复请求命中 │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
└────────────────────┬────────────────────────┘
                     ↓
         ┌───────────┴───────────┐
         ↓                       ↓
    Workers AI            OpenAI/Anthropic/...
    (默认)                (通过 API Key 切换)
```

---

## 3. 数据契约

### 3.1 新增 D1 表

```sql
-- ══════════════════════════════════════════════════
-- 表 G1: model_configs（模型路由配置）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS model_configs (
  id              TEXT PRIMARY KEY,
  purpose         TEXT NOT NULL CHECK(purpose IN ('CHAT','EMBEDDING')),
  provider        TEXT NOT NULL DEFAULT 'workers-ai'
                  CHECK(provider IN ('workers-ai','openai','anthropic','azure-openai')),
  model_name      TEXT NOT NULL,              -- 模型名，如 @cf/meta/llama-3.1-8b-instruct / gpt-4o
  display_name    TEXT,                       -- 管理后台显示名，如 "Llama 3.1 8B"
  is_default      INTEGER NOT NULL DEFAULT 0, -- 是否默认选中的模型
  is_active       INTEGER NOT NULL DEFAULT 1, -- 启用/停用
  rate_limit_rpm  INTEGER DEFAULT 30,         -- 每分钟请求数上限
  rate_limit_tpm  INTEGER DEFAULT 100000,     -- 每分钟 Token 上限
  cost_per_1k_input   REAL DEFAULT 0,         -- 每 1K 输入 Token 成本（美元）
  cost_per_1k_output  REAL DEFAULT 0,         -- 每 1K 输出 Token 成本（美元）
  config_json     TEXT DEFAULT '{}',           -- 额外配置，如 endpoint URL / api_key 引用名
  priority        INTEGER DEFAULT 0,          -- 优先级，高优先级的在条件满足时优先选
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 初始种子数据
INSERT INTO model_configs (id, purpose, provider, model_name, display_name, is_default) VALUES
('mc-chat-llama',   'CHAT',     'workers-ai', '@cf/meta/llama-3.1-8b-instruct-fp8',  'Llama 3.1 8B',  1),
('mc-chat-llama32', 'CHAT',     'workers-ai', '@cf/meta/llama-3.2-3b-instruct',       'Llama 3.2 3B',  0),
('mc-embed-e5',     'EMBEDDING', 'workers-ai', '@cf/intfloat/multilingual-e5-base',   'E5 Multilingual', 1);

-- ══════════════════════════════════════════════════
-- 表 G2: ai_call_logs（AI 调用日志，自定义分析用）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id        TEXT NOT NULL,               -- 关联的全链路 TraceID
  purpose         TEXT NOT NULL,               -- 'CHAT' / 'EMBEDDING'
  provider        TEXT NOT NULL,
  model_name      TEXT NOT NULL,
  user_id         TEXT,                        -- 关联用户（可为空，系统调用）
  agent_id        TEXT,                        -- 关联智能体
  task_id         TEXT,                        -- 关联任务
  kb_id           TEXT,                        -- 关联知识库（嵌入调用）
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  latency_ms      INTEGER DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'SUCCESS' CHECK(status IN ('SUCCESS','FAILED','RATE_LIMITED')),
  error_message   TEXT,
  cost_usd        REAL DEFAULT 0,              -- 预估成本
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_model ON ai_call_logs(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_logs_purpose ON ai_call_logs(purpose);

-- ══════════════════════════════════════════════════
-- 表 G3: user_rate_limits（用户级速率限制计数器）
-- ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_rate_limits (
  user_id     TEXT NOT NULL,
  purpose     TEXT NOT NULL,                   -- 'CHAT' / 'EMBEDDING'
  minute_bucket TEXT NOT NULL,                 -- 格式: '2026-06-22T14:35'
  call_count  INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, purpose, minute_bucket)
);
```

### 3.2 Agent 表扩展

`agents` 表新增字段（通过 `ALTER TABLE` 或 SQL 脚本）：

```sql
ALTER TABLE agents ADD COLUMN model_config_id TEXT REFERENCES model_configs(id);
```

这样每个智能体可以指定使用哪个模型配置。当 `model_config_id` 为 NULL 时，使用 `model_configs` 中 `is_default=1` 的 CHAT 模型。

### 3.3 TypeScript 接口

新增到 `packages/shared/src/types.ts`：

```typescript
// ══════════════════════════════════════════════════
// 7. AI Gateway 模块类型
// ══════════════════════════════════════════════════

export type ModelPurpose = 'CHAT' | 'EMBEDDING';
export type AIProvider = 'workers-ai' | 'openai' | 'anthropic' | 'azure-openai';
export type AICallStatus = 'SUCCESS' | 'FAILED' | 'RATE_LIMITED';

export interface ModelConfigRow {
  id: string;
  purpose: ModelPurpose;
  provider: AIProvider;
  model_name: string;
  display_name: string | null;
  is_default: number;
  is_active: number;
  rate_limit_rpm: number;
  rate_limit_tpm: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  config_json: string;  // JSON
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ModelConfigDTO {
  id: string;
  purpose: ModelPurpose;
  provider: AIProvider;
  modelName: string;
  displayName?: string;
  isDefault: boolean;
  isActive: boolean;
  rateLimitRpm: number;
  rateLimitTpm: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  config: Record<string, any>;
  priority: number;
}

export interface AIChatRequest {
  modelConfigId?: string;   // 指定模型配置，不指定则用默认
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  // 可观测上下文
  traceId: string;
  userId?: string;
  agentId?: string;
  taskId?: string;
}

export interface AIChatResponse {
  content: string;
  modelConfigId: string;
  provider: AIProvider;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
}

export interface AIEmbedRequest {
  modelConfigId?: string;
  input: string | string[];     // 单条或多条文本
  // 可观测上下文
  traceId: string;
  userId?: string;
  kbId?: string;
  taskId?: string;
}

export interface AIEmbedResponse {
  embeddings: number[][];       // 始终返回二维数组
  modelConfigId: string;
  provider: AIProvider;
  modelName: string;
  latencyMs: number;
  costUsd: number;
}

// ---- 管理端 DTO ----
export interface AICallLogQuery {
  startTime?: string;
  endTime?: string;
  userId?: string;
  modelName?: string;
  purpose?: ModelPurpose;
  status?: AICallStatus;
  page?: number;
  limit?: number;
}

export interface AICallLogDTO {
  id: number;
  traceId: string;
  purpose: ModelPurpose;
  provider: AIProvider;
  modelName: string;
  userId?: string;
  agentId?: string;
  taskId?: string;
  kbId?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: AICallStatus;
  errorMessage?: string;
  costUsd: number;
  createdAt: string;
}

export interface AIStatsDTO {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  rateLimitedCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  callsByModel: Array<{ modelName: string; count: number; costUsd: number }>;
  callsByHour: Array<{ hour: string; count: number }>;
}
```

---

## 4. 核心实现

### 4.1 AIClient（共享层，`packages/shared/src/ai-gateway.ts`）

```typescript
export class AIClient {
  constructor(private env: {
    AI_GATEWAY: { run: Function };  // AI Gateway binding
    DB: D1Database;
    KV: KVNamespace;
  }) {}

  /**
   * 聊天补全：自动选择模型 → 通过 AI Gateway 调用 → 记录日志
   */
  async chat(req: AIChatRequest): Promise<AIChatResponse> { ... }

  /**
   * 文本嵌入：自动选择嵌入模型 → 调用 → 记录日志
   */
  async embed(req: AIEmbedRequest): Promise<AIEmbedResponse> { ... }

  /**
   * 获取默认模型配置（按 purpose 取 is_default=1 的）
   */
  private async getDefaultModelConfig(purpose: ModelPurpose): Promise<ModelConfigRow> { ... }

  /**
   * 速率限制检查
   * 基于 user_id + purpose + 分钟桶，超过 rpm/tpm 则限流
   */
  private async checkRateLimit(userId: string, purpose: ModelPurpose): Promise<boolean> { ... }

  /**
   * 日志记录到 ai_call_logs
   */
  private async logCall(params: {
    traceId: string; purpose: ModelPurpose; provider: AIProvider;
    modelName: string; userId?: string; agentId?: string;
    taskId?: string; kbId?: string;
    inputTokens: number; outputTokens: number;
    latencyMs: number; status: string;
    errorMessage?: string; costUsd: number;
  }): Promise<void> { ... }
}
```

### 4.2 AI Gateway 配置

```toml
# wrangler.toml (workflow + rag worker 均需添加)
[ai_gateway]
binding = "AI_GATEWAY"
gateway_id = "swarm-ai-gateway"

# 旧的 [ai] binding 可保留做 fallback
[ai]
binding = "AI"
```

Cloudflare 侧创建 Gateway：

```bash
# 创建 AI Gateway
npx wrangler ai-gateway create swarm-ai-gateway

# 配置 OpenAI 作为额外 provider（可选）
npx wrangler ai-gateway provider add swarm-ai-gateway openai
```

AI Gateway 面板可配置：
- **缓存**：相同请求命中缓存（对嵌入调用很有用）
- **速率限制**：全局级别（如 "每分钟总请求数 ≤ 1000"）
- **日志**：自动记录所有请求/响应

### 4.3 模型选择逻辑

```
请求到达 AIClient.chat()
  │
  ├─ 指定了 modelConfigId？
  │    └─ 是 → 查 model_configs 表获取配置
  │    └─ 否 → 查 purpose='CHAT' 且 is_default=1 的配置
  │
  ├─ 配置存在且 is_active=1？
  │    └─ 否 → 降级到 workers-ai 默认模型（失败兜底）
  │
  ├─ 速率限制检查（user_id + purpose）
  │    └─ 超出 rpm/tpm → 返回 429, 记录 ai_call_logs(status=RATE_LIMITED)
  │
  ├─ 构造 AI Gateway 请求 URL
  │    └─ workers-ai:   POST /accounts/{account}/ai/run/@cf/meta/llama-...
  │    └─ openai:        POST /v1/chat/completions
  │
  ├─ 执行请求（带超时 30s）
  │
  └─ 记录 ai_call_logs（异步，不影响主流程）
```

### 4.4 与现有 workflow.ts 的集成

改造 `callLlmChatAndLog()`：

```typescript
// 改造前
const res = await ai.run(mappedModel, { messages });
// 改造后
const aiClient = new AIClient(env);
const response = await aiClient.chat({
  modelConfigId: agentModelConfigId,  // 从 agent 的 model_config_id 字段来
  systemPrompt: messages[0].content,
  messages: messages.slice(1),
  traceId: taskId,
  agentId: agent.id,
  taskId,
});
```

与 RAG Embedder 的集成：

```typescript
// 在文档处理 Workflow 中
const aiClient = new AIClient(env);
const response = await aiClient.embed({
  input: chunks.map(c => `passage: ${c.text}`),
  traceId: taskId,
  kbId,
  taskId,
});
```

---

## 5. 防御设计

| 场景 | 兜底策略 |
|------|---------|
| AI Gateway 不可用（网络故障） | 降级到直接 `env.AI.run()`（原生 Workers AI binding） |
| 模型配置不存在或被禁用 | 自动选取同 purpose 的其他 active 模型，或返回明确错误 |
| 速率限制触发 | `ai_call_logs` 记录 `RATE_LIMITED`，向用户返回友好提示"系统繁忙，请稍后重试" |
| Token 用量超限 | 通过 `ai_call_logs` 触发告警，通知管理员 |
| 模型调用超时 | AIClient 内置 30s 超时，超时后重试 1 次（切换到备选模型） |
| 日志写入失败 | 仅 `console.warn`，不影响主逻辑（日志丢失不阻塞业务） |

---

## 6. 分析看板

### AI Gateway 原生面板（Cloudflare Dashboard）

开箱即用：
- 请求量趋势图
- 延迟分布
- 缓存命中率
- 错误率
- 各 Provider 用量占比

### 自定义分析（基于 `ai_call_logs` 表）

```sql
-- 1. 按模型统计费用
SELECT model_name, COUNT(*) as calls, SUM(cost_usd) as total_cost
FROM ai_call_logs
WHERE created_at > datetime('now', '-7 days')
GROUP BY model_name
ORDER BY total_cost DESC;

-- 2. 按用户统计用量
SELECT user_id, COUNT(*) as calls, SUM(input_tokens + output_tokens) as total_tokens
FROM ai_call_logs
WHERE created_at > datetime('now', '-7 days')
GROUP BY user_id
ORDER BY calls DESC;

-- 3. 按 Agent 统计
SELECT agent_id, model_name, AVG(latency_ms) as avg_latency, COUNT(*) as calls
FROM ai_call_logs
WHERE agent_id IS NOT NULL
GROUP BY agent_id, model_name;

-- 4. 成本趋势（按天）
SELECT date(created_at) as day, SUM(cost_usd) as daily_cost
FROM ai_call_logs
GROUP BY day
ORDER BY day;
```

### 管理后台 API

```
GET /api/v1/admin/ai/stats         → AIStatsDTO        // 全局统计概览
GET /api/v1/admin/ai/logs          → AICallLogDTO[]     // 调用日志列表（带筛选分页）
GET /api/v1/admin/ai/models        → ModelConfigDTO[]   // 模型配置列表
POST /api/v1/admin/ai/models       → 创建或切换默认模型
PUT /api/v1/admin/ai/models/:id    → 修改模型配置（可动态切换）
```

---

## 7. 执行拆解

### Phase A: 共享层 AIClient（2 天）

- [ ] `packages/shared/src/types.ts` — 新增 3.3 节所有类型
- [ ] `packages/shared/src/ai-gateway.ts` — AIClient 实现（chat / embed / 速率限制 / 日志）
- [ ] `packages/shared/src/constants.ts` — AI Gateway 相关常量
- [ ] `packages/shared/src/schema.ts` — `modelConfigs` / `aiCallLogs` / `userRateLimits` 表定义

### Phase B: 数据库迁移（0.5 天）

- [ ] `backend/schema.sql` — 同步新增 DDL + 种子数据
- [ ] `agents` 表新增 `model_config_id` 字段
- [ ] D1 migrate 脚本

### Phase C: AI Gateway 基础配置（0.5 天）

- [ ] Cloudflare 侧创建 `swarm-ai-gateway`
- [ ] `workflow/wrangler.toml` — 添加 `[ai_gateway]` binding
- [ ] `rag/wrangler.toml` — 添加 `[ai_gateway]` binding
- [ ] 配置速率限制规则 / 缓存规则

### Phase D: 改造现有调用（1 天）

- [ ] `workflow.ts` — `callLlmChatAndLog()` 改为使用 AIClient.chat()
- [ ] `workflow.ts` — `runWorkerAgent()` 传递 modelConfigId
- [ ] `dynamic-tool.ts` — 工具中的 `llm_chat` / `llm_refinement` 改为使用 AIClient
- [ ] 保留 `env.AI` 作为 fallback

### Phase E: 管理后台（2 天）

- [ ] Admin Worker 新增模型配置管理 handler
- [ ] 管理后台前端：模型配置列表页 / 编辑页
- [ ] 管理后台前端：AI 调用日志查看页
- [ ] 管理后台前端：AI 用量统计看板

### Phase F: RAG 集成（与 RAG Phase 3 合并）

- [ ] RAG 文档处理的 `generate_embeddings` step 使用 AIClient.embed()

---

## 8. 与 RAG 设计的交叉影响

| RAG 设计中原定方案 | AI Gateway 接入后变化 |
|-------------------|---------------------|
| `embeddings` 通过 `env.AI.run()` 生成 | 改为 `AIClient.embed()`，走 AI Gateway |
| KV 缓存检索结果 | AI Gateway 也会缓存相同嵌入请求，双层缓存 |
| 无速率限制 | AIClient 内置用户级速率限制 + AI Gateway 全局限流 |
| 嵌入模型硬编码为 multilingual-e5-base | 通过 `model_configs` 表动态配置，可随时切换 |

---

## 9. 待定问题

1. **AI Gateway 与原生 AI binding 的关系**：是彻底替换 `[ai]` binding 还是 AI Gateway → fallback 原生 AI？建议保留原生 binding 作为 fallback，AI Gateway 不可用时自动降级。
2. **成本追踪精度**：Workers AI 不返回 Token 用量，需要估算（用字符数 × 系数），是否接受？
3. **管理后台 AI 日志页面**：放在现有 Admin Worker 中还是独立页面？

