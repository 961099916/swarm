# 《Llama 3.1 8B 大模型平滑升级 — 底层设计文档 LLD》

## 1. 架构定位 (Architectural Position)

由于 Cloudflare 官方于 2026-05-30 下线了 `@cf/meta/llama-3-8b-instruct` 大模型，导致当前系统的多智能体编排工作流在执行 Supervisor 决策和子 Agent 推理时，均抛出 `5028: This model was deprecated` 异常。

本变更的目标是：
1. 将系统大模型全局升级为官方推荐的 `@cf/meta/llama-3.1-8b-instruct`。
2. 修复 D1 云端数据库中存量智能体数据，防止预置智能体和历史自定义智能体继续使用废弃模型。
3. 统一规范代码中的默认大模型常量，为未来模型平滑升级奠定规范基础。

---

## 2. 数据修复契约 (Database Data Update)

在 schema.sql 中，建表默认值和预置智能体已经设置为了新版模型名。但由于云端数据库 `swarm-db` 中早已存在 `agents` 表和存量行，`INSERT OR IGNORE` 无法触达存量数据的更新。因此，我们需要通过 D1 远程命令执行以下数据升级 SQL：

```sql
-- 将所有使用旧模型的智能体一键平滑升级至 Llama 3.1
UPDATE agents 
SET model = '@cf/meta/llama-3.1-8b-instruct' 
WHERE model = '@cf/meta/llama-3-8b-instruct';
```

---

## 3. 控制流转与模块修改说明 (Proposed Changes)

### 3.1 编排引擎 (Workflow)
- **文件**: [workflow.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/workflow.ts)
- **改动说明**:
  - 定义常量 `const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";`
  - 替换 `executeLlmRefinement` 中硬编码的旧模型。
  - 替换 `callLlmChat` 中默认的回退模型值。
  - 替换 `getSupervisorDecision` 主控推理中硬编码调用的旧模型。

### 3.2 接口网关 (Gateway)
- **文件**: [agents.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/handlers/agents.ts)
- **改动说明**:
  - 定义常量 `const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";`
  - 替换创建自定义智能体 `handleCreateAgent` 中当 `body.model` 为空时的默认模型回退值。

### 3.3 前端展示层 (Frontend)
- **文件**: [DeployView.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/src/pages/index/components/DeployView.vue)
- **改动说明**:
  - 替换保存自定义智能体 `saveCustomAgent` 时请求参数中默认硬编码的 `model` 字段值。

---

## 4. 防御性设计 (Defensive Design)

- **常量提取**: 统一使用 `DEFAULT_MODEL` 常量隔离，防止硬编码模型 ID 散落在各个函数逻辑深处。
- **存量数据向后兼容**: 通过 SQL 数据迁移直接物理修改 D1 数据，而非在运行时写 if-else 做转换，保持数据与业务层面的逻辑清爽。

---

## 5. 执行拆解 (Todo List)

### 5.1 代码库模型常量替换
- [ ] 1. 修改 [workflow.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/workflow.ts)，引入并使用 `DEFAULT_MODEL`。
- [ ] 2. 修改 [agents.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/handlers/agents.ts)，引入并使用 `DEFAULT_MODEL`。
- [ ] 3. 修改 [DeployView.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/src/pages/index/components/DeployView.vue)，升级默认创建模型。

### 5.2 数据库存量修复
- [ ] 4. 运行 `wrangler d1 execute` 修复 `swarm-db` 中的旧模型字段数据。

### 5.3 重新部署与验证
- [ ] 5. 重新部署网关和工作流服务。
- [ ] 6. 运行大盘协同测试任务，验证日志中 ReAct 决策输出正常，无报错。
