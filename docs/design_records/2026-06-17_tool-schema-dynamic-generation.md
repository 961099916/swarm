 # 工具定义与 Supervisor Prompt 解耦 —— 基于注册表实时生成工具 Schema

 ## 状态
 - 日期: 2026-06-17
 - 作者: 首席全栈架构师
 - 状态: 已批准实施

 ## 背景
 现有架构中，`WorkflowTool` 接口仅定义 `name`、`description`、`execute` 三个字段，
 各工具预期的输入参数结构缺乏显式 Schema 声明。导致 Supervisor 的 System Prompt 中
 工具列表及入参示例必须以**硬编码字符串**形式写在 `workflow.ts` 内。

 该设计存在以下问题：
 1. **信息重复** — 工具名称和描述已在各个 `tools/*.ts` 中声明，prompt 中又重新写一遍
 2. **参数契约缺失** — 工具入参没有形式化描述，LLM 只能靠 prompt 中的自然语言示例猜测
 3. **维护脆弱** — 新增/修改工具时，开发者必须同步修改 prompt，极易遗漏

 ## 决策
 在每个 `WorkflowTool` 上增加 `inputSchema: InputField[]` 字段，由工具自身声明其
 输入参数结构。`ToolRegistry` 新增 `getToolDefinitions()` 方法，运行时遍历注册表
 生成所有工具的形式化定义。Supervisor System Prompt 据此实时拼接工具描述。

 ### 关键变更点
 1. `tools/types.ts` — 新增 `InputField`、`ParamType`、`ToolDefinition` 类型
 2. `tools/base.ts` — `BaseWorkflowTool` 增加 `inputSchema` 抽象属性
 3. `tools/registry.ts` — 新增 `getToolDefinitions()` 方法
 4. 各工具实现 — 实现 `inputSchema` 属性
 5. `workflow.ts` — 删除硬编码工具列表，改用 `ToolRegistry.getToolDefinitions()` 动态生成

 ## 影响
 - **正向**: 新增工具零侵入 prompt，只需注册工具类即可被 Supervisor 自动识别
 - **兼容性**: `execute()` 签名不变，不影响已有调用方
 - **风险**: 需确保旧工具都被添加 `inputSchema`，否则 `getToolDefinitions()` 返回不完整

 ## 替代方案
 曾考虑使用 JSON Schema 标准（`JSONSchemaType`），但当前项目规模不大，
 自定 `InputField[]` 更轻量，且对 LLM Prompt 的拼接更友好。
