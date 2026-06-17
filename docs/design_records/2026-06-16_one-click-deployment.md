# 架构决策记录 (ADR) - Swarm 后端多服务一键部署脚本设计方案

* 创建日期: 2026-06-16
* 状态: 已批准 (Approved)
* 作者: 首席全栈架构师

---

## 1. 架构定位
- **模块归属**: 项目运维与持续集成工具 (`backend/scripts/deploy-all.sh`)。
- **依赖关系与部署顺序**:
  - `gateway` 服务的 `wrangler.toml` 中配置了对 `swarm-admin` (ADMIN_SVC) 的服务绑定 (Service Bindings) 以及对 `swarm-workflow` (TASK_WORKFLOW) 的工作流绑定。
  - 为了避免 Cloudflare 平台在校验绑定关系时因目标服务不存在而报错，部署顺序必须为：
    1. **第一步**: 部署 `workflow` 服务 (`backend/workers/workflow`)
    2. **第二步**: 部署 `admin` 服务 (`backend/workers/admin`)
    3. **第三步**: 部署 `gateway` 服务 (`backend/workers/gateway`)

---

## 2. 核心控制流设计

### 2.1 脚本控制流转
1. **前置环境校验 (Pre-flight Checks)**:
   - 校验当前工作目录，确保在 `backend` 或项目根目录下运行。
   - 运行 `npx wrangler whoami` 校验 Cloudflare CLI 登录状态，若未登录则提前拦截并指导用户登录。
2. **本地编译预检 (Lint/Dry-Run)**:
   - 在部署前，在各 Workspace 执行 `npm run type-check`。如有任何类型报错，立刻熔断，避免将错误代码推送到线上。
3. **顺序部署与熔断 (Sequential Deployment with Circuit Breaker)**:
   - 依次进入各微服务目录执行 `npm run deploy`。
   - 捕获每次部署的退出码 (Exit Code)，一旦某个服务部署失败，立刻打印 `ERROR` 日志并退出脚本，防止产生不完整的服务链条。

---

## 3. 防御设计
- **未登录拦截**: 通过分析 `wrangler whoami` 输出或状态码，防止由于未授权导致的部署挂起或报错。
- **管道错误捕获 (`set -e`)**: 脚本开启 `set -e` 保证任何命令失败时能立刻终止执行。
- **环境隔离提示**: 在执行前输出当前 `wrangler.toml` 中绑定的 D1 数据库 ID 提示，确保用户确认部署环境（生产 vs 测试）。
