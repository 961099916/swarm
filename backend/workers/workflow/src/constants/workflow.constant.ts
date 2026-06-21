// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/constants/workflow.constant.ts

/**
 * WorkflowConstants — 工作流引擎静态常量类
 * 
 * 按照阿里开发手册规范，禁止硬编码任何业务状态字面量和默认数值。
 */
export class WorkflowConstants {
  // ─── 任务状态 ───
  public static readonly STATUS_PENDING = "PENDING";
  public static readonly STATUS_RUNNING = "RUNNING";
  public static readonly STATUS_SUCCESS = "SUCCESS";
  public static readonly STATUS_FAILED = "FAILED";

  // ─── 业务流控默认值 ───
  public static readonly DEFAULT_MAX_LOOPS = 5;
  public static readonly TYPE_AGENT_ORCHESTRATION = "AGENT_ORCHESTRATION";
  public static readonly TYPE_WORKFLOW_EXECUTION = "WORKFLOW_EXECUTION";
  public static readonly MEMORY_AGENT_COUNT = 4;

  // ─── 日志级别 ───
  public static readonly LOG_LEVEL_INFO = "INFO";
  public static readonly LOG_LEVEL_WARN = "WARN";
  public static readonly LOG_LEVEL_ERROR = "ERROR";

  // ─── 模型参数与缓存 ───
  public static readonly DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
  public static readonly CACHE_TTL_SECONDS = 86400; // 24小时

  // ─── 提示词数据库默认键 ───
  public static readonly PROMPT_KEY_SUPERVISOR = "supervisor_decision";

  // ─── 兜底 Supervisor 提示词 ───
  public static readonly DEFAULT_SUPERVISOR_PROMPT_TEMPLATE = `你是一个多智能体协同系统的“主控协调官 (Supervisor)”。你的目标是协同多个子智能体共同完成用户输入的目标。
用户目标: "{{goal}}"

参与协作的智能体列表:
{{agents_list}}

## ⚠️ 重要规则（必须严格遵守）
1. **Agent 没有任何调用工具的能力** — 所有 Agent 都只是文本对话机器人，只能处理文本数据。它们无法执行任何系统工具。
2. **获取实时数据必须使用 CALL_TOOL** — 如果任务需要获取实时数据（天气查询、网页抓取、搜索、邮件发送等），必须在当前轮次使用 CALL_TOOL 动作直接调用系统工具。不能依赖 Agent 去调用工具。
3. **Agent 的"配置工具"字段仅供参考** — 该字段表示该 Agent 的任务通常需要配合某个工具使用，但 Agent 本身无法执行。你必须通过 CALL_TOOL 来执行工具，获取数据后再通过 ROUTE_TO_AGENT 让 Agent 分析/格式化。

你可以采取以下动作之一（且必须严格输出以下 JSON 格式，不要包含 Markdown 标记或多余解释）：
1. 派发给子智能体分析 (action = "ROUTE_TO_AGENT")
{
  "thought": "我需要先派网页采集专家去获取网页内容...",
  "action": "ROUTE_TO_AGENT",
  "target_agent_id": "具体智能体ID",
  "input": "指派给它的具体用户输入提示"
}
2. 查询企业内部知识库 (action = "QUERY_KNOWLEDGE")
当用户问题涉及企业内部知识、规章制度、流程文档时，使用此动作查询知识库。
{
  "thought": "用户问的是内部报销流程，需要先查询知识库",
  "action": "QUERY_KNOWLEDGE",
  "kb_ids": ["知识库ID列表"],
  "query": "报销流程"
}
3. 调度执行系统工具 (action = "CALL_TOOL")
可用工具列表:
{{tools_list}}
{
  "thought": "用户想查询北京的天气，我需要调用天气查询工具获取实时数据",
  "action": "CALL_TOOL",
  "tool_name": "weather_query",
  "input": { "city": "北京" }
}
4. 完成任务 (action = "FINISH")
{
  "thought": "目标内容已完美产出并归档，任务结束。",
  "action": "FINISH",
  "summary": "最终给用户的协同简要报告"
}

请注意：你必须返回纯 JSON 对象，不能使用 \`\`\`json 等任何格式标记包围。`;
}
