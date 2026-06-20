# Architecture Decision Record (ADR) - 前端管理后台界面扩展方案 (RAG 知识库 & Quiz 评测管理)

**日期**: 2026-06-21
**作者**: Antigravity
**状态**: Approved (已批准)

---

## 1. 架构定位
- **所属模块**: 前端控制层与视图层 (Swarm Admin Web UI)
- **外部依赖**: `swarm-admin` 网关统一代理服务
- **拓扑解耦**:
  - 前端界面不与任何微服务直连，仅通过统一拦截器 `utils/request.ts` 与 `swarm-admin` 的 API 路由进行安全通信。
  - 请求时通过请求拦截器自动透传 MDC TraceID，响应拦截器对状态与业务异常（如 code !== 0）进行统一抛出，达到高度可观测性。

---

## 2. 核心契约与接口设计 (Web API Contracts)

### 2.1 知识库文档管理接口契约
- **获取全局文档列表**:
  - **请求**: `GET /api/v1/admin/knowledge/documents`
  - **参数**: 
    - `limit`: 每页条数 (pageSize)
    - `offset`: 偏移量 ((page - 1) * pageSize)
  - **响应**: 
    ```json
    {
      "code": 0,
      "message": "success",
      "data": [
        {
          "id": "doc-uuid-1",
          "kbId": "kb-uuid-1",
          "filename": "swarm_architecture.pdf",
          "fileSize": 102456,
          "createdAt": "2026-06-20T12:00:00Z"
        }
      ],
      "traceId": "trace-uuid-12345"
    }
    ```
- **删除特定文档**:
  - **请求**: `DELETE /api/v1/admin/knowledge/documents/delete?docId={docId}`
  - **响应**: 
    ```json
    {
      "code": 0,
      "message": "success",
      "data": { "success": true },
      "traceId": "trace-uuid-12345"
    }
    ```

### 2.2 Quiz 评测配置与测试管理接口契约
- **重置特定用户评测进度**:
  - **请求**: `POST /api/v1/admin/quiz/users/reset?userId={userId}`
  - **响应**: 
    ```json
    {
      "code": 0,
      "message": "success",
      "data": { "success": true },
      "traceId": "trace-uuid-12345"
    }
    ```
- **获取系统关卡配置**:
  - **请求**: `GET /api/v1/admin/quiz/configs`
  - **响应**: 
    ```json
    {
      "code": 0,
      "message": "success",
      "data": [
        {
          "key": "stage_config_level_1",
          "value": "{\"npcName\":\"新手智多星\",\"threshold\":80,\"questions\":[...]}"
        }
      ],
      "traceId": "trace-uuid-12345"
    }
    ```
- **热更新系统关卡配置**:
  - **请求**: `PUT /api/v1/admin/quiz/configs`
  - **请求体**: 
    ```json
    {
      "configs": [
        {
          "key": "stage_config_level_1",
          "value": "{\"npcName\":\"修改后的智多星\",\"threshold\":85,...}"
        }
      ]
    }
    ```
  - **响应**: 
    ```json
    {
      "code": 0,
      "message": "success",
      "data": { "success": true },
      "traceId": "trace-uuid-12345"
    }
    ```

---

## 3. 控制流转与页面逻辑 (Control Flow & UI UX Design)

### 3.1 路由与导航菜单装配
1. 修改 [router/index.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/router/index.ts)，在 `children` 中注册：
   - `/knowledge`: 关联组件 `@/views/knowledge/index.vue`
   - `/quiz`: 关联组件 `@/views/quiz/index.vue`
2. 修改 [layout/index.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/layout/index.vue) 菜单布局：
   - 侧边栏插入“知识库管理”菜单项 (使用 `Notebook` 图标)
   - 侧边栏插入“评测测试管理”菜单项 (使用 `Checked` 图标)

### 3.2 页面详细设计

#### A. 知识库管理视图 (`views/knowledge/index.vue`)
- **展示形式**: 采用磨砂玻璃质感 (`glass-card`) 的布局面板。
- **列表显示**: 使用 Element Plus `<el-table>` 渲染全局文档明细，包括：ID、文件名、大小(格式化为 KB)、所属知识库 ID 和创建时间。
- **物理删除**: 
  - 提供删除按钮，触发 `<el-popconfirm>` 二次警告。
  - 点击删除时，开启 loading 状态遮罩，发起 `DELETE` 请求，物理清空 D1 数据库记录与 D1 存储，保障空间及时回收。
  - 删除成功或失败均弹出符合系统风格的 `ElMessage` 并附带 TraceID 供排查。

#### B. 评测配置与测试管理视图 (`views/quiz/index.vue`)
- **排版结构**:
  - 上方卡片: **“用户评测进度治理”**
    - 提供输入框让管理员输入特定用户的 `User ID`。
    - 点击“重置进度”按钮时触发弹窗二次确认。物理清除该用户的通关进度与积分加权缓存，让其可以从头开始进行测评。
  - 下方卡片: **“评测关卡配置（JSON 热更新）”**
    - 使用大文本框展示格式化后的关卡配置 JSON。
    - 用户编辑后点击“保存并热更新配置”时，前端首先进行 `JSON.parse` 校验，格式非法立即红字拦截。
    - 校验通过后调用后台 PUT 接口，清除缓存并持久化新配置。

---

## 4. 防御与安全设计 (Defensive Design)
1. **客户端参数合法性校验 (Client-side Validation)**:
   - 重置进度输入框校验: 必须非空，防止发送无意义请求。
   - JSON 语法校验: 前端利用 `try/catch` 解析 Textarea 里的配置内容。如果解析失败，显示具体语法报错信息，禁止发包。
2. **多重安全确认 (Double Confirmation)**:
   - 文档物理删除与用户进度重置等高危写操作，一律挂载弹窗二次警告，避免手滑。
3. **TraceID 错误可观测性**:
   - 捕获 API 报错后，在 Message 提示窗内附带当前响应的 TraceID（格式：`操作失败: [原因] (TraceID: xxxxx)`），保证排查链路的顺畅。
