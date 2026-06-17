# ADR: 免重启在线动态工具开发系统设计

* **状态**: 已批准 (Approved)
* **日期**: 2026-06-17
* **作者**: Antigravity (Chief Architect)

## 1. 上下文与问题描述
在原有的 Swarm 智能体平台中，如果 Agent 协同任务需要使用新工具，开发者必须：
1. 在后端 `workflow` 服务的 `src/tools/` 下编写新的 TypeScript 代码。
2. 重新编译并部署 `workflow` Worker 服务。

这种硬编码的开发方式导致了平台无法动态扩展工具，服务更新频繁，影响了用户体验及开发效率。我们希望抽象出工具执行机制，支持将工具定义、API 转发模板或 JS 脚本直接存储在数据库中，在线配置并立即对 Agent 生效，免除服务重启部署。

## 2. 决策与设计方案
我们将原本的静态注册表升级为 **静态与数据库动态查询结合** 的双引擎模式。

### 2.1 数据持久层存储重构
重构原有 `tools` 数据库表，扩展字段，以兼容 No-Code API 代理与 FaaS 脚本引擎：
* `endpoint`: API 代理地址。
* `method`: HTTP 方法（GET / POST）。
* `headers`: 请求头 JSON 串。
* `body_template`: 请求体 JSON 模板（支持 `{{param}}` 参数插值）。
* `script`: 动态执行的 JS 脚本（支持 `new Function` 编译运行的轻量 FaaS）。
* `params_schema`: JSON 格式的参数校验约束契约。
* `response_selector`: JSONPath 形式的结果提取符。

### 2.2 核心执行流 (ReAct Tool Agent Proxy)
对于主控引擎来说，动态工具实现 `WorkflowTool` 接口，执行过程由 `DynamicWorkflowTool` 代理，对上层 Workflow 引擎透明。
1. **ToolRegistry 懒加载**：如果静态内存缓存未命中，自动去 D1 数据库加载并实例化缓存。
2. **Hybrid 运行策略**：如果 `script` 存在，使用 JS 沙箱执行脚本；如果只有 `endpoint` 存在，则直接使用 `fetch` 代理发送 HTTP 请求。

## 3. 防御设计与安全控制
1. **脱敏保护**：执行动态脚本时，对传入沙箱的 `context.env` 进行安全过滤（White-listing），仅暴露外部 API Token，隐去系统底层密钥。
2. **CPU 限时与熔断**：配置 15 秒强制超时机制，通过 `Promise.race` 熔断潜在的死循环与长时间阻塞，保障 Worker 主线程健康。
3. **unsafe_eval 异常捕获**：当 Cloudflare Workers 环境未配置 `unsafe_eval` 时，抛出友好中文提示，并引导用户使用声明式 API 代理模式。

## 4. 影响与结论
* **积极影响**：大幅降低 Agent 工具的拓展门槛，支持运营人员直接通过 UI 配置 API 或简单的 JS 脚本，实现分钟级上线新工具。
* **消极影响/风险**：引入 `new Function` 执行动态代码会带来一定的潜在安全隐患，但本平台工具维护属管理员后台专有权限，且经过沙箱脱敏，风险在可控范围内。
