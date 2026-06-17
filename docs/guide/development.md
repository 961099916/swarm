# 开发指南

## 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **Wrangler CLI** >= 3.0
- **Cloudflare 账号**
- **微信小程序 AppID**（前端开发时使用）

## 快速安装

### 1. 克隆并安装依赖

```bash
git clone https://github.com/<your-org>/swarm.git
cd swarm

# 共享层
cd backend/packages/shared && npm install

# 各 Worker
cd ../../workers/gateway && npm install
cd ../../workers/user && npm install
cd ../../workers/engine && npm install
cd ../../workers/admin && npm install
cd ../../workers/quiz && npm install
cd ../../workers/workflow && npm install

# 前端
cd ../../../frontend && npm install
```

### 2. 登录 Cloudflare

```bash
npm install -g wrangler
wrangler login
```

### 3. 创建 D1 数据库

```bash
wrangler d1 create swarm-db
```

将返回的 database_id 更新到各 Worker 的 `wrangler.toml` 中。

### 4. 创建 KV Namespace

```bash
wrangler kv namespace create CACHE_KV
```

将返回的 id 更新到 gateway 和 admin 的 `wrangler.toml` 中。

### 5. 初始化数据库

```bash
wrangler d1 execute swarm-db --file=backend/schema.sql
```

### 6. 配置环境变量

为每个 Worker 创建 `.dev.vars` 文件：

```bash
# backend/workers/gateway/.dev.vars
JWT_SECRET=your-jwt-secret-at-least-32-chars
INTERNAL_SECRET=your-internal-secret-at-least-32-chars
ALLOWED_ORIGIN=http://localhost:3000
WX_APP_ID=your_wx_app_id
WX_APP_SECRET=your_wx_app_secret
```

其他 Worker 的 `.dev.vars`:
```bash
# backend/workers/user/.dev.vars
INTERNAL_SECRET=your-internal-secret

# backend/workers/admin/.dev.vars
INTERNAL_SECRET=your-internal-secret

# backend/workers/engine/.dev.vars
INTERNAL_SECRET=your-internal-secret

# backend/workers/quiz/.dev.vars
INTERNAL_SECRET=your-internal-secret
```

## 本地开发

### 启动 Worker

每个 Worker 可以独立启动：

```bash
# 启动 API Gateway
cd backend/workers/gateway
npm run dev

# 在新终端中启动其他 Worker
cd backend/workers/user && npm run dev
cd backend/workers/engine && npm run dev
cd backend/workers/admin && npm run dev
cd backend/workers/quiz && npm run dev
```

Workflow Worker 需要特殊处理，因为 Cloudflare Workflows 当前不支持本地模拟：

```bash
cd backend/workers/workflow
npm run deploy  # 直接部署到远程
```

### 启动前端

使用微信开发者工具打开 `frontend/` 目录，配置 AppID 后即可预览。

## 代码规范

### TypeScript

- 严格模式 (`strict: true`)
- 禁止 `any` 类型
- 使用 `import type` 导入仅类型模块

### 命名

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `auth-middleware.ts` |
| 函数/变量 | camelCase | `handleLogin` |
| 类型/接口 | PascalCase | `UserRow` |
| 常量 | UPPER_SNAKE_CASE | `INITIAL_CREDITS` |
| 表字段 | snake_case | `wx_open_id` |
| Drizzle 字段 | camelCase | `wxOpenId` |

### 新增表的三步流程

1. `backend/packages/shared/src/schema.ts` — 定义 Drizzle 表
2. `backend/packages/shared/src/types.ts` — 定义行类型
3. `backend/schema.sql` — 同步 DDL

## 调试

### 查看本地日志

```bash
wrangler tail
```

### 使用 TraceID 追踪请求

每个请求都会生成唯一的 TraceID，通过 `X-Trace-Id` 响应头返回。在日志中搜索该 TraceID 即可查看完整请求链路。

## 测试

```bash
# TypeScript 类型检查
npx tsc --noEmit

# ESLint 检查
npx eslint .

# Prettier 格式化检查
npx prettier --check .
```

> 注意: 项目目前无单元测试覆盖。欢迎贡献测试用例。
