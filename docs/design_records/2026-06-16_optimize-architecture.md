# 架构决策记录 (ADR) - 2026-06-16 Swarm 系统架构重构与优化

## 1. 背景
Swarm 智能体编排系统中存在部分技术债：
- 模型名称在前后端多处硬编码。
- `workflow.ts` 承担了工具、公共数据库处理以及工作流主控等过多职责。
- 任务执行中部分 `catch` 吞掉了核心异常日志。

## 2. 决策与方案
- **模块解耦**：
  - 将模型名称提取至 `@swarm/shared` 包的 `types.ts`。
  - 提取 `workflow.ts` 内的边缘工具至单独的 `tools.ts`。
  - 提取数据库辅助函数及 JSON 解析器至单独的 `utils.ts`。
- **防御性日志**：
  - 捕获被吞掉的异常并通过 `appendTaskLog` 记录为 `ERROR` 级别日志。

## 3. 具体设计
详细设计细节与结构请参见原实施计划 [implementation_plan.md](file:///Users/zhangjiahao/.gemini/antigravity-ide/brain/8952e850-72ed-49ce-b1bf-7658f9248041/implementation_plan.md)。
