# 系统架构

## 概述

Swarm 采用**微服务 + 边缘计算**架构，基于 Cloudflare Workers 构建。所有服务运行在 Cloudflare 的边缘网络上，通过 Service Binding 实现服务间通信，通过 D1 Database 实现数据持久化。

```
┌─────────────────────────────────────────────────────┐
│                    微信小程序                        │
│          (TDesign 组件库 / 原生渲染)                  │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────┐
│              API Gateway (swarm-gateway)              │
│            Hono + JWT + CORS + TraceID               │
│     ┌───────────┬───────────┬──────────────┐        │
│     │ 鉴权中间件  │ 缓存中间件  │ 路由分发     │        │
│     └───────────┴───────────┴──────────────┘        │
└────┬──────┬──────┬──────┬──────┬────────────────────┘
     │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼
  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────────┐
  │User│ │Eng │ │Admin│ │Quiz│ │Workflow│
  │SVC │ │SVC │ │SVC  │ │SVC │ │Engine  │
  └─┬──┘ └─┬──┘ └──┬──┘ └──┬──┘ └───┬────┘
    │      │       │       │        │
    └──────┴───────┴───────┴────────┘
                   │
              ┌────▼────┐
              │  D1 DB  │
              │ (SQLite)│
              └─────────┘
```

## 分层架构

### 接入层 — API Gateway

**技术**: Hono + Cloudflare Workers

职责:
- 统一流量入口，处理 CORS、TraceID 注入
- JWT 鉴权 + Token 版本校验
- RBAC 角色权限控制 (FREE_USER / VIP_USER / ADMIN)
- 缓存双写失效（管理操作后同步废弃 KV 缓存）
- Service Binding 安全转发至内部 Worker

关键设计:
- Gateway **不包含任何业务逻辑**，只做路由编排和鉴权
- 内部 Worker 通过 `X-Internal-Key` + `X-User-Role` 双重校验
- 全链路 TraceID 透传，每条日志附带 TraceID

### 业务层 — 内部微服务

所有内部微服务仅接受来自 Gateway 的 Service Binding 请求，不直接对外暴露。

| 服务 | 职责 | 关键依赖 |
|------|------|----------|
| **User SVC** | 微信登录、JWT 签发、积分管理 | D1, KV |
| **Engine SVC** | Agent 生命周期、任务调度 | D1, AI |
| **Admin SVC** | 管理后台 API（用户/Agent/审计） | D1, KV |
| **Quiz SVC** | 闯关评测引擎 | D1 |

### 编排层 — Workflow Engine

**技术**: Cloudflare Workflows (Durable Execution)

基于 Workflow 的长期运行、可恢复的多 Agent 编排引擎:

1. **Supervisor 调度**: 主管 Agent 接收任务，分解为子任务，委派给子 Agent
2. **动态工具注册表**: 工具可通过数据库动态注册，Workflow 启动时从 DB 加载
3. **记忆管理**: 自动截断上下文窗口，控制 Token 预算
4. **结果汇总**: 收集所有 Agent 输出，生成结构化摘要

```
Task → Supervisor Agent → 分解子任务
                          ├── Agent A → Tool X → 结果
                          ├── Agent B → Tool Y → 结果
                          └── Agent C → Tool Z → 结果
                          ↓
                    汇总 → 结构化摘要
```

### 共享层 — @swarm/shared

跨 Worker 共享的核心库，实现业务与技术物理隔离:

| 模块 | 说明 |
|------|------|
| `schema.ts` | Drizzle 表定义（所有 Worker 使用同一份） |
| `types.ts` | TypeScript 类型定义与 DTO |
| `constants.ts` | 业务常量集中管理 |
| `logger.ts` | TraceLogger — 结构化日志、数据脱敏 |
| `cache.ts` | CacheService — 防穿透(Null占位)防雪崩(TTL Jitter) |

### 持久层

| 存储 | 用途 |
|------|------|
| **D1 Database** | 主数据库：用户、任务、Agent、积分、日志 |
| **KV Namespace** | 缓存：用户鉴权缓存、会话 |

### 前端层

**技术**: 微信小程序 + TDesign 组件库

采用分包策略优化加载性能:
- **主包**: 任务列表、部署、地图、积分、我的
- **分包**: 任务详情/Agent管理、管理后台、闯关评测

## 技术选型理由

| 决策 | 选择 | 理由 |
|------|------|------|
| 运行时 | Cloudflare Workers | 边缘计算低延迟，免运维，全球分发 |
| Web 框架 | Hono | 轻量、类型安全、Workers 原生支持 |
| ORM | Drizzle ORM | 类型安全、零运行时依赖、SQLite 原生 |
| 数据库 | D1 (SQLite) | Workers 原生、无需单独数据库服务 |
| 前端 | 微信小程序原生 | 微信生态、TDesign 企业级组件 |
| 工作流 | Cloudflare Workflows | 长时间运行、自动重试、状态持久化 |
| AI 推理 | Workers AI (LLaMA) | 边缘推理、无需 GPU 管理 |

## 安全架构

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│ 微信小程序    │────▶│ API Gateway   │────▶│ 内部     │
│ (HTTPS + JWT)│     │ (JWT验证+     │     │ Worker   │
│              │     │  InternalKey) │     │(双重校验)│
└─────────────┘     └──────────────┘     └──────────┘
```

1. **传输安全**: 全链路 HTTPS
2. **鉴权**: Gateway JWT 验证 → 内部 Worker Internal Key 二次校验
3. **缓存一致性**: 管理操作自动废弃网关缓存，防止安全延迟漏洞
4. **数据脱敏**: TraceLogger 自动过滤密码、Token 等敏感字段
5. **日志审计**: 所有管理操作记录审计日志

## 可观测性

### TraceID 全链路透传

```
请求 → Gateway (生成TraceID) → 内部Worker (携带TraceID) → D1/KV (日志携带TraceID)
        ↓
     Response (X-Trace-Id Header)
```

### 结构化日志 (TraceLogger)

所有日志遵循统一结构:

```typescript
interface LogPayload {
  traceId: string;
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  module: "GATEWAY" | "USER" | "ENGINE" | "WORKFLOW" | "QUIZ" | "ADMIN";
  event: string;
  userId?: string;
  message: string;
  payload?: any;        // 经过数据脱敏
  exception?: {...};    // ERROR 级别时附带
}
```

## 相关 ADR

- [网关设计模式](/docs/design_records/2026-06-16_gateway-design-pattern.md)
- [企业级重构方案](/docs/design_records/2026-06-17_enterprise-refactoring-and-optimization.md)
- [Drizzle ORM 集成](/docs/design_records/2026-06-16_drizzle-orm-integration.md)
- [缓存一致性方案](/docs/design_records/2026-06-17_admin-cache-consistency.md)
- [工具设计模式](/docs/design_records/2026-06-16_tools-design-pattern.md)
