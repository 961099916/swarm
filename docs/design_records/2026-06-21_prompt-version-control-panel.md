# Architecture Decision Record (ADR) - 全局 Prompt 提示词版本管理面板设计

**日期**: 2026-06-21
**作者**: Antigravity
**状态**: Approved (已批准)

---

## 1. 架构定位
- **所属模块**: 分布式控制后台与状态中心 (Swarm Admin Prompt Manager)
- **依赖说明**:
  - 对接 SQLite D1 数据库中的 `prompts` 表，实现 `(key, version)` 复合主键的高效维护。
  - 操作生效时，同步物理清除 `CACHE_KV` 中以 `prompt:${key}` 为键的运行时缓存，保障 Workflow 主控执行智能体时能够秒级热加载最新的活跃 Prompt。

---

## 2. 核心契约与接口设计 (Internal API Contracts)

### 2.1 获取全系统 Prompt 密钥简要列表
- **请求**: `GET /api/v1/admin/prompts`
- **响应**:
  ```json
  {
    "code": 0,
    "message": "success",
    "data": [
      {
        "key": "supervisor_decision",
        "activeVersion": 1,
        "latestVersion": 2,
        "description": "主控协调决策核心 System Prompt",
        "lastUpdated": "2026-06-20T12:00:00Z"
      }
    ],
    "traceId": "trace-uuid-123"
  }
  ```

### 2.2 获取某个 Key 的所有历史版本
- **请求**: `GET /api/v1/admin/prompts/versions?key={key}`
- **响应**:
  ```json
  {
    "code": 0,
    "message": "success",
    "data": [
      {
        "key": "supervisor_decision",
        "version": 2,
        "content": "修改后的主控决策内容...",
        "description": "主控协调决策核心 System Prompt v2",
        "isActive": false,
        "createdAt": "2026-06-20T14:00:00Z"
      },
      {
        "key": "supervisor_decision",
        "version": 1,
        "content": "第一版主控内容...",
        "description": "主控协调决策核心 System Prompt",
        "isActive": true,
        "createdAt": "2026-06-20T12:00:00Z"
      }
    ],
    "traceId": "trace-uuid-123"
  }
  ```

### 2.3 切换特定 Prompt 版本的激活状态 (回滚/灰度)
- **请求**: `POST /api/v1/admin/prompts/active`
- **请求体**:
  ```json
  {
    "key": "supervisor_decision",
    "version": 1
  }
  ```
- **处理逻辑**:
  1. 在 D1 事务中，首先将该 `key` 下的所有版本 `is_active` 置为 0。
  2. 将指定 `version` 的 `is_active` 置为 1。
  3. 调用 `CACHE_KV.delete("prompt:" + key)` 驱逐缓存。
- **响应**: `{ "code": 0, "message": "success", "data": { "success": true } }`

### 2.4 发布新版本 Prompt
- **请求**: `POST /api/v1/admin/prompts/create`
- **请求体**:
  ```json
  {
    "key": "supervisor_decision",
    "content": "这是全新发布版本的 Prompt 内容...",
    "description": "发布说明"
  }
  ```
- **处理逻辑**:
  1. 查出当前 `key` 下的最新 `version` 值，若不存在则初始为 1，存在则累加 `newVersion = latestVersion + 1`。
  2. 在事务中废弃旧活跃版本，并插入新版本且 `is_active = 1`。
  3. 驱逐缓存 `CACHE_KV.delete("prompt:" + key)`。
- **响应**: `{ "code": 0, "message": "success", "data": { "success": true, "version": 3 } }`

---

## 3. 控制流转与页面设计 (UI UX Layout)

### 3.1 导航与路由集成
- 修改 [router/index.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/router/index.ts)：注册新路由 `/prompts`，指向 `@/views/prompts/index.vue`。
- 修改 [layout/index.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/layout/index.vue)：在菜单中挂载“提示词管理”项 (使用 `Brush` 图标)。

### 3.2 页面布局与交互设计 (`views/prompts/index.vue`)
- **双栏式高级布局**:
  - **左半屏 (或主表格区)**: 展示全系统 Prompt 键简要表。使用磨砂玻璃面板 (`glass-card`)，提供 Key 搜索，列出激活版本与最新版本的比对。
  - **右半屏 (详情/版本时序图)**: 点击左侧某个 Key，右侧实时拉取其全部版本时序。每一个版本为一个卡片节点。
    - 点击具体版本，可展开以带有黑色背景、橙黄色代码高亮效果的 `<pre class="code-pre">` 框渲染当前提示词的 content 原文，极其精美。
    - 针对非当前活跃的版本提供一键“回滚/设为激活”按钮，带有二次弹窗确认保护。
    - 提供“发布新版本”悬浮按钮，弹窗提供 `el-input type="textarea"` 在线编辑，前端预校验非空和语法格式，安全同步。

---

## 4. 防御与安全设计
1. **多重事务一致性**: 激活和新建 Prompt 均受 D1 SQL Batch 事务包裹。若版本数增写或者更新状态某一步失败，全局回滚，保证 `prompts` 表不出现多版本同时 `is_active = 1` 的逻辑坏死。
2. **安全双删与缓存同步**: 必须强制清除以 `prompt:${key}` 为名的 KV 缓存。即使 KV 清理失败，也要抛出异常保证操作安全， workflow 服务读取时就会由于缓存失效自动回源 D1。
3. **TraceID 错误透传**: 在前端提交新版本或切换版本出错时，Message 弹出框内展示 TraceID 以便在可观测性日志中精准排错。
