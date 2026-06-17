# 《Llama 3.2 3B 大模型平滑升级 — 底层设计文档 LLD (修订版)》

## 1. 架构定位 (Architectural Position)

在部署了 Llama 3.1 8B (@cf/meta/llama-3.1-8b-instruct) 之后，系统运行依然遇到 5028 废弃报错。经深度查证，Cloudflare 官方已于 2026-05-30 同时废弃并下线了 Llama 3.0 (8B) 以及 Llama 3.1 (8B) 两款初代模型。

本变更将大模型版本一次性平滑推进至目前 Cloudflare Workers AI 处于活跃制造且性能出色的 Llama 3.2 (3B) 智能体模型：**`@cf/meta/llama-3.2-3b-instruct`**。

---

## 2. 数据修复契约 (Database Data Update)

为了防止存量数据继续干扰编排工作流，我们需要远程对云端 D1 数据库执行以下一键平滑数据更新语句，将全部旧模型（Llama 3 和 Llama 3.1）迁移至 Llama 3.2：

```sql
UPDATE agents 
SET model = '@cf/meta/llama-3.2-3b-instruct' 
WHERE model = '@cf/meta/llama-3-8b-instruct' 
   OR model = '@cf/meta/llama-3.1-8b-instruct';
```

同时，我们同步修改 [schema.sql](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/schema.sql) 种子数据中的默认值和插入数据以与生产保持完全一致。

---

## 3. 控制流转与模块修改说明 (Proposed Changes)

### 3.1 编排引擎 (Workflow)
- **文件**: [workflow.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/workflow.ts)
- **改动说明**:
  - 将 `DEFAULT_MODEL` 常量更新为 `"@cf/meta/llama-3.2-3b-instruct"`。

### 3.2 接口网关 (Gateway)
- **文件**: [agents.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/handlers/agents.ts)
- **改动说明**:
  - 将 `DEFAULT_MODEL` 常量更新为 `"@cf/meta/llama-3.2-3b-instruct"`。

### 3.3 前端展示层 (Frontend)
- **文件**: [DeployView.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/src/pages/index/components/DeployView.vue)
- **改动说明**:
  - 将保存自定义智能体 `saveCustomAgent` 时请求参数中的默认硬编码 `model` 字段更新为 `"@cf/meta/llama-3.2-3b-instruct"`。

### 3.4 本地 SQL 模板
- **文件**: [schema.sql](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/schema.sql)
- **改动说明**:
  - 修改 `agents` 表的 `model` 字段默认值为 `'@cf/meta/llama-3.2-3b-instruct'`。
  - 修改预置种子智能体（网页采集专家、深度分析师、邮件通知官）的 `model` 为 `'@cf/meta/llama-3.2-3b-instruct'`。

---

## 4. 防御性设计 (Defensive Design)

- **类型及支持链检查**: `@cf/meta/llama-3.2-3b-instruct` 被内置集成于 `workerd` 的类型声明中，能完全与 `ai.run` 的标准消息格式兼容，可无缝平移。

---

## 5. 执行拆解 (Todo List)

### 5.1 代码库模型常量替换
- [ ] 1. 修改 [workflow.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/workflow.ts)。
- [ ] 2. 修改 [agents.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/handlers/agents.ts)。
- [ ] 3. 修改 [DeployView.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/src/pages/index/components/DeployView.vue)。
- [ ] 4. 修改 [schema.sql](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/schema.sql)。

### 5.2 数据库存量修复
- [ ] 5. 运行 `wrangler d1 execute` 升级 `swarm-db` 中的所有智能体模型为 Llama 3.2 3B。

### 5.3 重新部署与验证
- [ ] 6. 部署 `swarm-workflow` 与 `swarm-gateway`。
- [ ] 7. 发起测试任务，验证 ReAct 闭环和非 Mock 情况下的智能体推理流。
