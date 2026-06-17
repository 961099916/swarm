 # 天气查询助手预置智能体种子数据

 ## 状态
 - 日期: 2026-06-17
 - 作者: 首席全栈架构师
 - 状态: 已批准实施

 ## 背景
 系统中已实现 `weather_query` 工具并注册至 ToolRegistry，但缺少一个可直接使用的
 天气查询智能体。需要创建一个系统预置（isPreset=1）的智能体种子数据，并补全
 API 安全白名单 `ALLOWED_TOOLS`，使天气查询能力对终端用户可访问。

 ## 决策
 1. 在 `schema.sql` 追加一条 `INSERT OR IGNORE` 种子数据，ID 为 `sys-agent-weather`
 2. 将 `"weather_query"` 加入 `ALLOWED_TOOLS` 常量数组

 ## 智能体定义
 - ID: `sys-agent-weather`
 - 名称: 天气查询助手
 - 图标: `cloud-sun`
 - 角色: 负责查询实时天气信息
 - 工具: `["weather_query"]`
 - 模型: `@cf/meta/llama-3.1-8b-instruct-fp8`

 ## 影响
 - schema.sql 新增一行种子数据，`INSERT OR IGNORE` 确保幂等
 - ALLOWED_TOOLS 追加一个工具名，不影响已有功能
