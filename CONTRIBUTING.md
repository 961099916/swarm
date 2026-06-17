# Swarm 贡献指南

## 概述

本项目遵循**阿里巴巴前端规约**与开源最佳实践。所有代码提交均应符合以下规范。

---

## 一、代码风格

### 缩进与格式

- 使用 2 空格缩进，禁止 Tab
- 行尾使用 LF，禁止 CRLF
- 文件末尾保留一个空行
- 删除行尾多余空格

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| TypeScript 文件 | kebab-case | `auth-middleware.ts` |
| 函数/变量 | camelCase | `handleLogin`, `getCorsHeaders` |
| 类/接口/类型 | PascalCase | `TaskOrchestrator`, `UserRow` |
| 常量 | UPPER_SNAKE_CASE | `INITIAL_CREDITS`, `AD_REWARD` |
| 环境变量 | UPPER_SNAKE_CASE | `JWT_SECRET`, `ALLOWED_ORIGIN` |
| SQL 表/列 | snake_case | `wx_open_id`, `token_version` |
| Drizzle 字段 | camelCase（映射到 snake_case） | `wxOpenId`, `tokenVersion` |
| 目录名 | kebab-case | `handlers/`, `utils/` |

### 引号

- 字符串统一使用双引号 `"`（TypeScript / JavaScript）
- JSX 属性使用双引号

### 分号

- 语句末尾必须加分号

### 注释

- 文件头部使用 `/**` JSDoc 模块注释说明职责
- 函数使用 JSDoc 风格注释（参数、返回值、异常）
- 复杂逻辑块使用 `// ───` 分隔线 + 单行注释
- 避免冗余注释（如 `// 设置变量`），只写"为什么"而非"做什么"

---

## 二、TypeScript 规范

### 严格模式

- `tsconfig.json` 中必须开启 `strict: true`
- 禁止使用 `any` 类型（允许 `warn` 级别警告，但应逐步消除）
- 优先使用 `type` 关键字声明类型，而非 `interface`（除非需要合并声明）

### 类型导入

- 使用 `import type` 导入仅用于类型的模块，避免运行时代价

```typescript
// ✅ 正确
import { users } from "@swarm/shared";
import type { UserRow } from "@swarm/shared";

// ❌ 错误
import { UserRow } from "@swarm/shared";
```

### 空值处理

- 优先使用 `??`（nullish coalescing）而非 `||`
- 优先使用 `?.`（optional chaining）避免深层 `&&` 判断

```typescript
// ✅ 正确
const name = user?.nickname ?? "匿名用户";

// ❌ 错误
const name = user.nickname || "匿名用户";
```

### 函数签名

- 函数参数超过 3 个时使用接口/类型包裹
- 使用 `async/await` 替代原始 Promise 链

---

## 三、后端规范

### 架构分层

```
gateway/            # API 网关层（鉴权 + 路由转发）
  src/
    handlers/       # 业务处理器
    utils/          # 工具函数（response, validator, drizzle）
admin/              # 管理后台内网服务
  src/
    handlers/
workflow/           # 工作流引擎
  src/
    tools/          # 工具注册表 + 策略实现
```

### 路由设计

- Gateway 负责：CORS / TraceID / 鉴权 / 路由分发
- Admin/Quiz 作为内部 Service Binding Worker，不直接对外暴露
- 内部 Worker 通过 `X-Internal-Key` + `X-User-Role` 双重校验

### 错误处理

- 所有 handler 使用 try/catch 包裹
- 使用 `ResponseBuilder` 统一响应格式
- 永远不要吞掉异常 `catch (e) {}`
- 日志必须携带 TraceID

### 数据库

- SQL schema 使用 snake_case
- Drizzle ORM 字段使用 camelCase，通过列名参数映射
- 所有查询优先使用精确匹配 `eq()`，禁止模糊匹配 `like()` 用于 ID 查询

---

## 四、前端规范

### 文件组织

- 每个页面一个独立目录：`pages/<module>/<page-name>/`
- 页面文件：`.js` / `.json` / `.wxml` / `.wxss`
- utils 目录存放纯逻辑工具函数

### 状态管理

- 全局状态通过 `app.js` 的 `globalData` 管理
- 页面级别状态使用 Page `data` 属性
- 避免在多个页面重复相同的状态处理逻辑

### 请求封装

- 统一使用 `utils/request.js` 里的 `request()` 函数
- 401 自动跳登录页
- 403 弹窗提示

---

## 五、提交规范

### Commit Message 格式

```
<type>(<scope>): <subject>

<body>
```

| Type | 含义 |
|------|------|
| feat | 新功能 |
| fix | 修复 Bug |
| refactor | 重构（不涉及功能变更） |
| style | 代码风格变更（格式化、命名） |
| docs | 文档变更 |
| chore | 工具/配置变更 |
| security | 安全修复 |

### 示例

```
fix(gateway): 修复邀请查询使用 like 导致的安全缺陷

将 users.id 的模糊查询改为精确匹配 eq()
```

---

## 六、工具链

### 前置检查

```bash
# 安装依赖
npm install

# TypeScript 类型检查
npm run type-check
```

### 编辑器

- 安装 ESLint 和 Prettier 插件
- 启用"保存时自动格式化"
- 使用 `.editorconfig` 确保跨编辑器一致性

---

## 七、参考资料

- [阿里巴巴前端规约](https://github.com/ali-rules/ali-spec)
- [TypeScript Coding Guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)


## 八、GitHub 开源工作流

### Fork 与分支策略

1. 在 GitHub 上 Fork 本仓库
2. 克隆你的 Fork 到本地：

   ```bash
   git clone https://github.com/<your-username>/swarm.git
   cd swarm
   git remote add upstream https://github.com/<original-org>/swarm.git
   ```

3. 从最新的 `master` 创建功能分支：

   ```bash
   git fetch upstream
   git checkout -b feat/your-feature-name upstream/master
   ```

### 分支命名规范

| 前缀          | 用途               | 示例                             |
|---------------|--------------------|----------------------------------|
| `feat/`     | 新功能             | `feat/wechat-payment`          |
| `fix/`      | 修复 Bug           | `fix/gateway-auth-timeout`     |
| `refactor/` | 重构               | `refactor/workflow-engine`     |
| `docs/`     | 文档变更           | `docs/api-usage-guide`         |
| `chore/`    | 工具/配置变更      | `chore/upgrade-wrangler`       |
| `security/` | 安全修复           | `security/xxe-protection`      |

### 提交 Pull Request

1. **确保代码通过本地校验**：

   ```bash
   # TypeScript 类型检查
   npx tsc --noEmit

   # ESLint 检查
   npx eslint .

   # Prettier 格式化
   npx prettier --check .
   ```

2. **提交前同步上游最新代码**：

   ```bash
   git fetch upstream
   git rebase upstream/master
   ```

3. **创建 PR** 时请提供：
   - 清晰的标题（遵循提交规范）
   - 关联的 Issue 编号（如 `Closes #123`）
   - 变更说明与影响范围
   - 测试步骤（如有）

4. **PR 审查标准**：
   - 至少 1 名维护者 Review 通过
   - 所有 CI 检查通过
   - 无冲突且基于最新 master

### Issue 提交规范

提交 Issue 时请选择对应模板（如存在）：

- **Bug 报告**：描述复现步骤、预期行为、实际行为、运行环境
- **功能请求**：描述需求背景、期望方案、替代方案（如有）
- **问题讨论**：描述遇到的问题和已尝试的排查步骤

### 代码审查（Code Review）原则

- 审查者关注：正确性、安全性、性能、可维护性、测试覆盖
- 提交者应对每条评论做出回应（修改或解释理由）
- 保持 PR 体积适中（建议不超过 400 行变更），大变更应拆分为多个 PR

### 持续集成（CI）

合并到 `master` 分支将触发：

- TypeScript 类型检查
- ESLint 代码规范检查
- Prettier 格式检查
- 单元测试执行

请确保在提交前本地运行以上检查。

---

## 九、开发环境快速搭建

### 首次设置

```bash
# 1. 安装依赖（各 Worker 独立安装）
cd backend/packages/shared && npm install
cd ../../workers/gateway && npm install
cd ../../workers/user && npm install
cd ../../workers/engine && npm install
cd ../../workers/admin && npm install
cd ../../workers/quiz && npm install
cd ../../workers/workflow && npm install
cd ../../../frontend && npm install

# 2. 配置本地环境变量
cp backend/workers/gateway/.dev.vars.example backend/workers/gateway/.dev.vars
# 编辑 .dev.vars 填入实际密钥

# 3. 创建 D1 数据库（本地开发）
npx wrangler d1 create swarm-db --local
npx wrangler d1 execute swarm-db --local --file=backend/schema.sql
```

### 本地开发命令

| 命令                          | 说明                   |
|-------------------------------|------------------------|
| `npm run dev`               | 启动本地开发服务器     |
| `npm run deploy`            | 部署到生产环境         |
| `npm run type-check`        | TypeScript 类型检查    |
| `npm run lint`              | ESLint 检查            |
| `npx prettier --check .`    | Prettier 格式检查      |
