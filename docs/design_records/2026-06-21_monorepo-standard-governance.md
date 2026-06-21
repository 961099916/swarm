# 架构决策记录 (ADR) - 项目工程化与大厂 Monorepo 规范重构方案

- **状态**: 批准执行 (Approved)
- **日期**: 2026-06-21
- **作者**: Antigravity

## 1. 上下文与问题描述
当前项目后端代码采用了多微服务（`workers/*`）和公共内核（`packages/*`）的目录划分，但包管理采用了 npm workspaces，存在幽灵依赖防范性差、依赖锁一致性弱、包名无统一 namespace 规范的缺点。
为了满足大厂级高质量工程标准，降低各微服务打包体积，提升依赖安全与契约的严密对齐，我们决策将依赖管理升级为 **pnpm workspaces**，统一重命名为 `@swarm/` scope，并引入代码提交质量门禁。

## 2. 决策与重构规范

### 2.1 依赖治理升级：pnpm workspaces 迁移
- 废弃根目录 `package-lock.json` 与 npm workspaces。
- 根目录引入 `pnpm-workspace.yaml` 管控包范围：
  ```yaml
  packages:
    - 'backend/packages/*'
    - 'backend/workers/*'
  ```
- 统一使用 `workspace:*` 协议取代 `*`，约束各子包仅通过符号链关联本地 workspace 代码。

### 2.2 子包和微服务的 Scope 化命名空间
对所有的 workers 内部子项目的 `package.json` 中的 `name` 统一加上 `@swarm/worker-` 前缀以作命名空间隔离。
- `swarm-user` -> `@swarm/worker-user`
- `swarm-engine` -> `@swarm/worker-engine`
- `swarm-admin` -> `@swarm/worker-admin`
- `swarm-gateway` -> `@swarm/worker-gateway`
- `swarm-workflow` -> `@swarm/worker-workflow`
- `swarm-quiz` -> `@swarm/worker-quiz`
- `swarm-rag` -> `@swarm/worker-rag`
- `swarm-consumer` -> `@swarm/worker-consumer`
- `swarm-doc-consumer` -> `@swarm/worker-doc-consumer`

### 2.3 共享契约包建立
- 引入 `@swarm/types`（路径 `backend/packages/types`），收集前后端完全一致的 API 路由路径、Request/Response TS interface 契约，彻底摆脱多处维护 DTO 导致的代码漂移。

### 2.4 TS 配置继承
- 根目录建立 `tsconfig.base.json`，子包 extends 继承它以实现 strict 等参数的高内聚。

### 2.5 拦截门禁
- 引入 Husky，在 pre-commit 勾子中通过 lint-staged 限制有坏味道的代码混入 Git 历史。

## 3. 防御设计
- **防幽灵依赖**：pnpm 的嵌套式 `node_modules` 结构使得未在 `package.json` 中声明的依赖无法被 Node.js 加载，直接在开发编译期阻断幽灵依赖冷启动报错。
- **Lint 校验熔断**：紧急情况下使用 `--no-verify` 可人工放行，但默认开发必须执行本地校验。
