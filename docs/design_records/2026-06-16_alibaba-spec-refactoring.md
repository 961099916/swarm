# 架构决策记录 (ADR) - 工具层（tools.ts）阿里规约物理拆分与架构规整重构

* 创建日期: 2026-06-16
* 状态: 已批准 (Approved)
* 作者: 首席全栈架构师

---

## 1. 架构定位
- **模块归属**: 后端工作流引擎工具层设计优化 (`backend/workers/workflow/src`)。
- **主要重构目标**:
  - 创建具体工具策略目录 `src/tools/` [NEW]。
  - 提取 `src/tools/types.ts` [NEW] (契约接口)。
  - 提取 `src/tools/base.ts` [NEW] (模板基类)。
  - 提取 `src/tools/registry.ts` [NEW] (注册表容器)。
  - 创建 6 个具体的工具文件 [NEW]。
  - 重构 `src/tools.ts` [MODIFY] 作为 Facade 出口及注册绑定中心。
- **解耦设计**:
  - **物理隔离**：摒弃巨石类文件，遵循“一个文件只定义一个核心类”的原则。
  - **接口透明**：重构后，`tools.ts` 作为对外的兼容 Facade 出口，其导出的 API 及 `ToolRegistry` 对外保持 100% 签名兼容，保证 `workflow.ts` 零改动。

---

## 2. 重构后的目录树规划
```text
backend/workers/workflow/src/
├── tools.ts (Facade 统一门面入口)
├── utils.ts
├── workflow.ts
└── tools/ (独立策略物理目录)
    ├── types.ts (定义 ToolContext, WorkflowTool 契约接口)
    ├── base.ts (实现 BaseWorkflowTool 模板方法基类)
    ├── registry.ts (管理 ToolRegistry 注册中心)
    ├── web-fetch.ts (网页抓取策略类)
    ├── weather-query.ts (天气查询策略类)
    ├── search-web.ts (搜索引擎检索策略类)
    ├── email-notify.ts (邮件发送策略类)
    ├── llm-refinement.ts (AI文本精炼策略类)
    └── llm-chat.ts (AI普通对话策略类)
```

---

## 3. 核心契约 (位于 `src/tools/types.ts`)

```typescript
// 1. 上下文契约
export interface ToolContext {
  traceId: string;
  env: {
    DB?: any;
    AI?: any;
    WEATHER_API_KEY?: string;
    SEARCH_API_KEY?: string;
    EMAIL_API_KEY?: string;
    EMAIL_FROM?: string;
    [key: string]: any;
  };
}

// 2. 工具契约
export interface WorkflowTool<TInput = any> {
  readonly name: string;
  readonly description: string;
  execute(input: TInput, ctx: ToolContext): Promise<string>;
}
```

---

## 4. 防御设计
- **文件沙盒隔离**：由于每个工具独立成文件，新增或重写某个工具的校验和执行逻辑时，不需要触碰其他已稳定运行的工具代码，最大限度地减少了代码合并冲突和引入未知故障的可能。
- **异常捕获与 TraceID 透传**：异常捕获机制继续委托在 `BaseWorkflowTool` 的模板方法中，统一打印包含 `traceId` 的 ERROR 日志，并优雅返回以 `[ERROR]` 开头的错误提示字符串。
