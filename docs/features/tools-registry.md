# 动态工具注册表

## 概述

Tool Registry 是 Swarm 的插件式工具管理系统。工具可通过数据库动态注册，Workflow 启动时从 DB 加载，Agent 运行时可安全调用。

## 核心架构

```
┌─────────────────┐
│   ToolRegistry   │
│   (单例注册表)    │
└────────┬────────┘
         │ 注册/查找
    ┌────┴────┐
    │  D1 DB  │
    │ (tools 表)│
    └─────────┘
         │
    ┌────┴────┐
    │ Handler │
    │ 执行器   │
    └────┬────┘
         │ 安全沙箱
    ┌────┴────┐
    │  沙箱   │
    │ 执行环境 │
    └─────────┘
```

## 工作流程

```
1. 系统启动 → ToolRegistry 从 DB 加载所有活跃工具
2. Agent 请求执行工具 → Registry 查找工具定义
3. Registry 验证输入参数（JSON Schema）
4. 在安全沙箱中执行 Handler
5. 返回执行结果
```

### 注册流程

```typescript
// 工具注册表定义
interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  schema: JSONSchema;    // 输入参数 Schema
  handler: string;       // 处理函数
  isActive: boolean;
}
```

工具注册有两种方式：

1. **数据库动态注册**（推荐）— 通过管理后台创建工具记录，Workflow 启动时自动加载
2. **代码硬注册** — 直接在代码中调用 `ToolRegistry.register()`

### 执行流程

```typescript
const context: ToolContext = {
  traceId,
  db,
  ai,
  env,
};

const result = await ToolRegistry.execute("tool-name", params, context);
```

## 安全沙箱

Tool 执行在安全沙箱中，限制：

- **无网络访问**（除特定白名单 API）
- **无文件系统访问**
- **无进程创建**
- **环境变量过滤** — 移除敏感密钥
- **执行超时** — 防止死循环
- **内存限制** — 防止内存溢出

### 沙箱配置

```typescript
const safeEnv = {};  // 空环境变量，不暴露任何密钥

const executionContext = {
  traceId,
  env: safeEnv,
  timeoutMs: 30000,
};
```

## 内置工具

| 工具名称 | 说明 |
|----------|------|
| weather-query | 天气查询 |
| search-web | 网页搜索 |
| web-fetch | 网页内容获取 |
| email-notify | 邮件通知 |
| llm-chat | LLM 对话 |
| llm-refinement | LLM 文本优化 |

## 数据库表

```sql
CREATE TABLE tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  schema TEXT NOT NULL,     -- JSON Schema
  handler TEXT NOT NULL,    -- Handler 标识
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 添加新工具

### 方式一：通过管理后台

1. 登录管理后台 → 工具管理
2. 填写工具名称、描述、JSON Schema
3. 保存后自动生效

### 方式二：通过 Seed 脚本

```javascript
// scripts/import-uapis.js
const tools = [
  {
    id: "my-tool",
    name: "My Tool",
    description: "My custom tool",
    schema: {
      type: "object",
      properties: {
        input: { type: "string" }
      }
    },
    handler: "my-tool-handler",
    isActive: true,
  },
];
```

## 相关 ADR

- [工具设计模式](/docs/design_records/2026-06-16_tools-design-pattern.md)
- [动态数据库工具](/docs/design_records/2026-06-17_dynamic-database-tools.md)
- [工具 Schema 动态生成](/docs/design_records/2026-06-17_tool-schema-dynamic-generation.md)
- [动态工具字段兼容性](/docs/design_records/2026-06-17_compatibility-of-dynamic-tool-fields.md)
- [批量导入 UAPI 工具](/docs/design_records/2026-06-17_batch-import-uapis-tools.md)
