# Swarm 文档

> 企业级智能体编排平台 — 基于 Cloudflare Workers 的多 Agent 协同工作流引擎

---

## 文档目录

### 📐 架构

| 文档 | 说明 |
|------|------|
| [系统架构](/docs/architecture/README.md) | 整体架构设计、分层职责、技术选型理由 |
| [网关设计模式](/docs/design_records/2026-06-16_gateway-design-pattern.md) | ADR: Gateway 职责与 Service Binding 转发策略 |
| [企业级重构方案](/docs/design_records/2026-06-17_enterprise-refactoring-and-optimization.md) | ADR: 企业级架构重构决策 |

### 🚀 开发指南

| 文档 | 说明 |
|------|------|
| [开发环境搭建](/docs/guide/development.md) | 本地开发环境配置、依赖安装、调试 |
| [生产部署](/docs/guide/deployment.md) | 生产环境部署流程、Secrets 管理、CI/CD |

### 🔌 API 参考

| 文档 | 说明 |
|------|------|
| [API 参考](/docs/api/README.md) | 所有 API 端点、请求/响应格式、错误码 |

### 🗄️ 数据库

| 文档 | 说明 |
|------|------|
| [数据库 Schema](/docs/database/README.md) | 所有表定义、关系、索引说明 |

### 🧩 功能模块

| 文档 | 说明 |
|------|------|
| [多智能体编排](/docs/features/multi-agent.md) | Workflow 引擎、Agent 调度、Supervisor 模式 |
| [闯关测评系统](/docs/features/quiz-system.md) | Stage 配置、评分引擎、奖励体系 |
| [管理后台](/docs/features/admin-panel.md) | 用户管理、审计日志、操作流程 |
| [动态工具注册表](/docs/features/tools-registry.md) | 插件式工具架构、安全沙箱 |



## 📋 开发流程

| 文档 | 说明 |
|------|------|
| [开发流程规范](/docs/development-process.md) | 从 56 份 ADR 提炼的全栈开发方法论 |

### 流程速览

```
Phase 1 [架构与计划] ──→ 输出 LLD，挂起等待审批
         │
         ▼ 用户输入 "APPROVE"
Phase 2 [方案评审] ──→ 仅更新 LLD 和契约
         │
         ▼
Phase 3 [编码与执行] ──→ ADR 归档 → 严格编码
```

### 📋 架构决策记录 (ADR)

[设计记录目录](/docs/design_records/) 包含 50+ 份架构决策文档，涵盖：

- **网关与微服务**: 网关设计模式、Handler 重构、Service Binding
- **工作流引擎**: Agent 编排、工具注册表、LLM 升级
- **前端架构**: SPA 重构、UI 主题、组件库迁移
- **数据库**: Drizzle ORM 集成、Schema 设计
- **安全与可观测性**: 鉴权中间件、缓存一致性、TraceLogger
