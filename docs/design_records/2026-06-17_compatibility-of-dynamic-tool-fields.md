# 架构决策记录 (ADR)：D1 动态工具字段命名兼容与运行时崩溃修复

* **状态**：已批准 (Approved)
* **日期**：2026-06-17
* **作者**：Antigravity (首席全栈架构师)
* **上下文 (Context)**：在多智能体工作流执行“北京天气”协同调度时，主控试图通过 `weather_query` 获取实时天气数据，导致抛出 `[ERROR] 工具 weather_query 执行失败: this.inputSchema is not iterable` 的崩溃异常。经排查，D1 数据库原生 SQL 语句查询返回的字段采用蛇形下划线格式（如 `params_schema`），而代码中 `DynamicWorkflowTool` 构造函数和 API 代理器期望读取驼峰格式属性（如 `paramsSchema`），这导致字段读取为 `undefined`，进而引发迭代错误和 API 代理参数失效。

---

## 架构定位与拓扑
工作流引擎在实例化与执行动态工具时，需要直接将底层 D1 原生查询结果转换为统一的对象模型。

```
                     D1 数据库 (SQLite)
                             │ (SELECT * FROM tools)
                             ▼ 返回蛇形字段
              [ ToolRegistry.getOrLoad() ]
                             │ 传入 DynamicToolRow
                             ▼
              [ DynamicWorkflowTool.constructor ]
                  ┌──────────┴──────────┐
                  ▼                     ▼
          有驼峰字段?            无驼峰字段, 降级读取蛇形字段!
     (row.paramsSchema)        (row.params_schema)
                  │                     │
                  └──────────┬──────────┘
                             ▼
                    进行 JSON.parse()
                  ┌──────────┴──────────┐
                  ▼                     ▼
             解析成功              解析失败 / 空值
        this.inputSchema = [...]   this.inputSchema = [] (安全防爆兜底)
```

## 契约设计与双重映射

为兼容 Drizzle ORM 契约与 D1 原生 SQL 的返回，需对以下核心字段进行双重兼容解析：

*   `paramsSchema` / `params_schema`: 参数校验 Schema，解析失败时防呆兜底为 `[]`。
*   `bodyTemplate` / `body_template`: API 代理模式的请求 Body 模板。
*   `responseSelector` / `response_selector`: API 代理模式的响应级联提取路径。

---

## 决策 (Decision)

1. **兼容垫片 (Compatibility Shims)**：
   在 `DynamicWorkflowTool` 构造函数中，对 `paramsSchema` 同时兼容 `params_schema`；对解析出的结果如果为空或非法，提供安全兜底空数组 `[]`。
2. **代理参数转换兼容**：
   在 `runApiProxyMode` 中兼容读取下划线版的 `body_template` 与 `response_selector`，确保 API 代理模式的功能稳定性。

---

## 后果与防范措施 (Consequences & Mitigation)

* **优点**：无需对底层 D1 所有的 SQL 映射逻辑进行全局重构，局部解决驼峰和蛇形的差异性，保障系统的高内聚低耦合。
* **安全性与稳定性**：防止因数据库脏数据（非标准 JSON 字符串）或者字段缺失直接导致的主控线程崩溃。
