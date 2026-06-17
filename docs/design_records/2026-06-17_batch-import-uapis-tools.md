# 架构决策记录 (ADR)：清除历史工具并一键批量导入 uapis.cn 100+ 免费工具集

* **状态**：已批准 (Approved)
* **日期**：2026-06-17
* **作者**：Antigravity (首席全栈架构师)
* **上下文 (Context)**：为丰富智能体的工具生态，用户要求清空数据库 `tools` 表，并将 UAPI 平台（https://uapis.cn/docs/api-reference/introduction ）提供的 100+ 免费 REST API 抽取为“API 代理模式 (No-Code)”工具批量添加至数据库中，且不破坏现有 Workers 的物理安全架构约束（避开 `new Function`）。

---

## 导入逻辑设计

通过读取和解析 `uapis.cn` 官方的 OpenAPI 定义（`openapi.json`），利用编写的自动化脚本批量转换并生成规范 SQL 导入：

```
  [ UAPI openapi.json ] (本地缓存)
           │
           ▼ (执行 import-uapis.js 脚本解析)
  [ 生成批量 SQL 插入语句 ]
           │
           ▼ (wrangler d1 execute 批量插入远程 D1)
    [ D1 Database ]  <--- 清空 tools 并插入 100+ 工具
           │
           ▼ (重新部署 workflow 强制冷启动刷新缓存)
   [ 智能体工作流引擎 ] <--- 获得 100+ 动态工具调用能力
```

### 工具转换规则

对于 OpenAPI 中声明的每一个 API 路径与方法，做如下契约转换：
1. **命名转换 (`name`)**：
   将 `operationId` （如 `get-misc-weather`）中的横线转为下划线，作为唯一的工具名称（如 `get_misc_weather`）。
2. **模式设置**：
   - 将 `script` 字段置为 `NULL`，触发进入 API 代理模式。
   - `method` 映射为对应的 HTTP 方法（如 `GET`, `POST`）。
   - `headers` 默认设置为 `'{}'`。
3. **Endpoint 构建**：
   - 基础 URL 统一设为 `https://uapis.cn/api/v1` + `path`。
   - **GET 请求**：将该路径支持的所有 `query` 参数拼接在 Endpoint 尾部，形如：`?param1={{param1}}&param2={{param2}}`。当实际调用时，未传入的可选参数占位符会由 `dynamic-tool.ts` 中的正则净化规则自动剥除，以防报错。
   - **POST 请求**：将 RequestBody 中的属性构造为 JSON 字符串作为 `body_template`。
4. **参数定义 (`params_schema`)**：
   提取参数的类型、名称、是否必填、描述，转化为 JSON 字符串形式的 `InputField[]` 契约结构。

---

## 缓存与热生效保证

执行 SQL 变更后，为确保 `ToolRegistry` 的内存实例缓存被完全刷新，必须重新运行一次 `wrangler deploy`，使线上工作流 Worker 容器发生物理冷启动，从而热加载最新导入的工具。
