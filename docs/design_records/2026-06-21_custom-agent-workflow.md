# 架构决策记录 (ADR) - 自定义 Agent 工作流编排（支持条件分支与双Tab部署）

- **状态**: 批准执行 (Approved)
- **日期**: 2026-06-21
- **作者**: Antigravity

## 1. 上下文与问题描述
在目前的 Swarm 智能体协同平台中，任务编排完全基于 ReAct 主控大模型（Supervisor）进行多轮动态推理和指派路由。虽然该模式具备灵活性，但其路径缺乏可预测性、Token 消耗大且存在长轮数死循环的可能。
为了支持有高确定性、高可预测性要求的业务场景，我们需要为用户提供在微信小程序端自定义步骤流程（包括子智能体节点、边缘工具节点、条件分支路由节点）的静态编排与可视化执行功能。

## 2. 决策与设计方案

### 2.1 小程序端双 Tab 编排面板 (pages/deploy)
将 TabBar 的“部署”页面改造为包含两个 Tab 的选项卡面板：
- **Tab 1: 自动协同**：继续承载 Supervisor 动态问答与决策路由流。
- **Tab 2: 自定义流**：承载带有步骤树（树状卡片）的静态工作流编辑器，支持添加“智能体节点”、“系统工具节点”和“条件判定节点”，并在移动端界面提供树形缩进的可视化逻辑链。

### 2.2 后端有向无环图（DAG）状态机 (WORKFLOW_EXECUTION)
新增任务类型 `WORKFLOW_EXECUTION`。在 Cloudflare Workflows 的 `TaskOrchestrator` 入口内，若遇到此任务类型，将启动图遍历状态机（Graph Traverser）：
- 初始化 `currentInput = goal`（全局目标输入），`currentStepId = firstStepId`。
- 循环顺序读取当前步骤节点，若为 `agent` / `tool` 顺次执行，并将输出结果覆盖写入 `currentInput` 传递给下一步骤。
- 若为 `condition` 节点，则调用轻量级 LLM 分类器对 `currentInput` 进行分类选择匹配的跳转路径，更新 `currentStepId` 到对应分支节点。

### 2.3 状态与可观测性
- 引入 `[Step-START]`、`[Step-SUCCESS]`、`[Step-FAILED]` 等标准化节点路由特征日志，方便前台解析并渲染可视化的步骤执行状态时间轴（Timeline）。

## 3. 防御设计
- **死循环熔断**：为防止循环分支配置不当，最大图跳转深度限额 `maxTraversals = 20`，超限强制中止并报警。
- **匹配退避**：当 LLM 分类器输出任何不吻合分类时，强制落入 `defaultNextStepId` 兜底。
- **Fail-Fast**：一旦任意节点返回失败，流程立刻熔断标记任务 `FAILED`，中止后续节点，防止 Token 浪费。
