# File: docs/design_records/2026-06-15_agent-orchestrator.md

# 慢任务智能编排系统（Agent Orchestrator）— 底层设计文档 LLD v5

## 背景与目标

构建一套面向 ToC 独立变现的**边缘智能体编排平台**，依托 Cloudflare Serverless 基础设施实现：
- 零服务器常驻成本、按需弹性扩容
- Workers 多单元拆分
- 管理端全量用户/任务/权限管控
- 社交裂变邀请增长闭环

---

## ✅ 架构决策最终确认（v5）

| # | 决策项 | 最终方案 | 状态 |
|---|--------|----------|------|
| 1 | Token 生成 | Web Crypto HS256 + `token_version` 一键失效 | ✅ |
| 2 | JWT Role 可信性 | JWT 不携带 role，每次从 DB 实时加载 | ✅ |
| 3 | Workers 拆分 | **3 Worker + 1 Workflow monorepo** | ✅ |
| 4 | 广告积分防刷 | SHA-256 幂等哈希 | ✅ |
| 5 | 前端 UI 设计 | **iOS 27 Liquid Glass** 完整设计系统 | ✅ |
| 6 | D1 数据库拆分 | **❌ 明确否决**，单库 + `db.batch()` 原子批写 | ✅ |
| 7 | .env.example | 生成 | ✅ |

---

## 一、Cloudflare Workers 限制与拆分必要性分析

### 关键限制（Paid Plan）

| 限制项 | 数值 | 影响分析 |
|--------|------|----------|
| **Bundle Size** | ~10MB（压缩后） | 纯 TS 代码无外部依赖，预计 <200KB，不构成瓶颈 |
| **CPU 时间** | 5 分钟/请求上限 | I/O 等待不计入，D1 查询不影响 CPU 配额 |
| **子请求数** | 10,000/次调用 | 充裕 |
| **D1 数据库** | 10GB | 充裕 |
| **D1 并发连接** | 6 个/Worker 实例 | ✅ 每个 Worker **实例**独立计算，3个Worker各自拥有独立的6连接池，不存在跨Worker竞争 |

### 拆分的真实动机（非 Bundle Size）

> [!IMPORTANT]
> Cloudflare Workers 拆分的核心原因**不是** Bundle Size（对于纯 TS 项目 <200KB 完全无压力），而是：
>
> 1. **安全隔离**：Admin Worker 无公开 URL，只能通过 Service Binding 访问，管理面与用户面物理隔离
> 2. **独立部署**：Admin 功能迭代不触碰主 API，零用户感知
> 3. **D1 连接独立**：每个 Worker 实例拥有独立的 6 连接池，Admin Worker 的复杂聚合查询天然不占用 Gateway Worker 的连接，这是 Workers 拆分后的自然结果，无需再拆 D1
> 4. **Workflow 原生隔离**：Cloudflare Workflows 天然就是独立 Worker 单元

### 最终 Workers 拆分方案（3+1）

```
┌─────────────────────────────────────────────────────────────────┐
│  公网入口                                                         │
│                                                                   │
│  swarm-gateway (Worker 1)          ← 唯一拥有公开 URL 的 Worker   │
│  负责: 路由分发 / JWT鉴权 / 用户侧全量业务接口                      │
│  Bindings: DB · AI · TASK_WORKFLOW · ADMIN_SVC(ServiceBinding)   │
└────────────────────┬────────────────────────────────────────────┘
                     │ Service Binding (内存级，无公网)
          ┌──────────┴──────────┐
          ▼                     ▼
┌─────────────────┐   ┌────────────────────────────────────────┐
│  swarm-admin    │   │  swarm-task-workflow (Workflow)         │
│  (Worker 2)     │   │  class TaskOrchestrator                │
│                 │   │                                         │
│  无公开 URL     │   │  Bindings: DB · AI · Resend · WX API   │
│  仅 Service     │   └────────────────────────────────────────┘
│  Binding 可达   │
│  Bindings: DB   │
└─────────────────┘
          │
          ▼
    Cloudflare D1
```

### Service Binding 通信模式（Gateway → Admin）

```typescript
// Gateway 鉴权后，透传内部请求头给 Admin Worker
// Admin Worker 无需 JWT 验签，信任内部 X-User-* 头

// gateway/src/index.ts 中的转发逻辑
const internalReq = new Request(request.url, {
  method: request.method,
  body: request.body,
  headers: {
    ...Object.fromEntries(request.headers),
    'X-User-Id':      user.id,
    'X-User-Role':    user.role,
    'X-Internal-Key': env.INTERNAL_SECRET,   // 防止直接绕过调用
  }
});
const adminRes = await env.ADMIN_SVC.fetch(internalReq);
return adminRes;
```

---

## 二、完整架构图

```
微信小程序 (uni-app Vue3/TS)
       │ HTTPS
       ▼
┌─────────────────────────────────────────────────────┐
│  swarm-gateway (公网 Worker)                         │
│  ── 公开路由 ────────────────────────────────────── │
│  POST /api/v1/auth/login                            │
│  ── 用户路由（JWT鉴权中间件）─────────────────────── │
│  GET  /api/v1/user/profile                          │
│  POST /api/v1/auth/logout                           │
│  POST /api/v1/credits/bind-invite                   │
│  POST /api/v1/credits/reward                        │
│  GET  /api/v1/credits/history                       │
│  POST /api/v1/tasks/create                          │
│  GET  /api/v1/tasks/list                            │
│  GET  /api/v1/tasks/logs                            │
│  ── 管理路由（转发至 ADMIN_SVC）───────────────────  │
│  /api/v1/admin/* → env.ADMIN_SVC.fetch(...)         │
└──────────┬─────────────────────────┬────────────────┘
           │ Service Binding          │ Service Binding
           ▼                          ▼
┌──────────────────┐       ┌─────────────────────────┐
│  swarm-admin     │       │  swarm-task-workflow     │
│  (内网 Worker)   │       │  (Cloudflare Workflow)   │
│                  │       │  TaskOrchestrator        │
│  /admin/stats    │       │  Step1: fetch-market     │
│  /admin/users    │       │  Step2: ai-analysis      │
│  /admin/tasks    │       │  Step3: notify           │
│  ...             │       │  Step4: finalize         │
└──────────┬───────┘       └───────────┬─────────────┘
           │                           │
           └──────────┬────────────────┘
                      ▼
                Cloudflare D1
                (7 张表)
```

---

## 三、Monorepo 目录结构

```
swarm/
├── backend/
│   ├── packages/
│   │   └── shared/                     # 跨 Worker 共享包
│   │       ├── src/
│   │       │   └── types.ts            # 全量 TS 类型（Env/DTO/Row/Response）
│   │       └── package.json            # { "name": "@swarm/shared" }
│   │
│   ├── workers/
│   │   ├── gateway/                    # Worker 1：公网主网关
│   │   │   ├── src/
│   │   │   │   ├── index.ts            # 路由分发 + CORS
│   │   │   │   ├── jwtHelper.ts        # Web Crypto HS256
│   │   │   │   ├── authMiddleware.ts   # token_version + ban 校验
│   │   │   │   ├── creditsHelper.ts    # 积分原子操作 + ledger
│   │   │   │   └── handlers/
│   │   │   │       ├── auth.ts         # login / logout
│   │   │   │       ├── user.ts         # profile
│   │   │   │       ├── credits.ts      # bind-invite / reward / history
│   │   │   │       └── tasks.ts        # create / list / logs
│   │   │   ├── wrangler.toml
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── admin/                      # Worker 2：管理服务（无公网URL）
│   │   │   ├── src/
│   │   │   │   ├── index.ts            # 路由分发（信任 X-User-* 内部头）
│   │   │   │   └── handlers/
│   │   │   │       └── admin.ts        # 全量 8 个管理端接口
│   │   │   ├── wrangler.toml
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── workflow/                   # Workflow：TaskOrchestrator
│   │       ├── src/
│   │       │   └── workflow.ts         # TaskOrchestrator 4步DAG
│   │       ├── wrangler.toml
│   │       ├── package.json
│   │       └── tsconfig.json
│   │
│   ├── schema.sql                      # D1 全量建表 DDL（7张表）
│   ├── .env.example
│   └── package.json                   # Workspace 根配置
│
├── frontend/                           # uni-app Vue3/TS 小程序
```

---

## 四、D1 数据库结构与建表 DDL (7张表)

### Cloudflare D1 (SQLite 方言)

-- 表 1: users（用户主表）
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  wx_open_id      TEXT NOT NULL UNIQUE,        -- 微信 OpenID
  nickname        TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'FREE_USER' CHECK(role IN ('FREE_USER','VIP','ADMIN')),
  credits         INTEGER NOT NULL DEFAULT 0,  -- 当前积分余额
  token_version   INTEGER NOT NULL DEFAULT 1,  -- JWT 版本号，一键下线
  is_banned       INTEGER NOT NULL DEFAULT 0,  -- 0=正常, 1=封禁
  banned_reason   TEXT,
  invited_by      TEXT REFERENCES users(id),   -- 邀请人
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_users_wx_open_id ON users(wx_open_id);

-- 表 2: role_permissions（RBAC 权限）
CREATE TABLE IF NOT EXISTS role_permissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT NOT NULL,
  resource   TEXT NOT NULL,
  action     TEXT NOT NULL,
  UNIQUE(role, resource, action)
);

-- 表 3: tasks（任务主表）
CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id          TEXT NOT NULL REFERENCES users(id),
  task_type        TEXT NOT NULL CHECK(task_type IN ('PRICE_MONITOR','CONTENT_DAILY')),
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELLED','SLEEPING')),
  payload          TEXT NOT NULL,              -- JSON 参数
  workflow_run_id  TEXT,                       -- Workflow 实例 ID
  credits_cost     INTEGER NOT NULL DEFAULT 0,
  result_summary   TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks(status);

-- 表 4: task_logs（任务日志）
CREATE TABLE IF NOT EXISTS task_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    TEXT NOT NULL REFERENCES tasks(id),
  level      TEXT NOT NULL DEFAULT 'INFO' CHECK(level IN ('INFO','WARN','ERROR')),
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);

-- 表 5: user_invitations（邀请记录）
CREATE TABLE IF NOT EXISTS user_invitations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_id  TEXT NOT NULL REFERENCES users(id),
  invitee_id  TEXT NOT NULL REFERENCES users(id) UNIQUE,
  bonus_given INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 表 6: ad_reward_logs（广告幂等）
CREATE TABLE IF NOT EXISTS ad_reward_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL REFERENCES users(id),
  ad_token_hash TEXT NOT NULL UNIQUE,   -- SHA-256(ad_token)
  credits_added INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 表 7: credits_ledger（流水账本）
CREATE TABLE IF NOT EXISTS credits_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  delta       INTEGER NOT NULL,
  balance     INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  ref_id      TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_id ON credits_ledger(user_id);
```
