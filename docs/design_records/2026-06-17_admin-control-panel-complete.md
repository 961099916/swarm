# ADR: 全局管理控制台 (Admin Control Panel) 全栈功能补齐方案

* **状态**: 已批准 (Approved)
* **日期**: 2026-06-17
* **作者**: Antigravity (Chief Architect)

## 1. 架构定位
为了实现 Swarm 智能体编排平台的自闭环运营，我们将对管理后台（后端 Admin Worker 与前端微信小程序 `packageAdmin` 分包）进行全栈级别的升级：

```
                                  [ 微信小程序端 (Frontend) ]
                                                │
         ┌──────────────────────┬───────────────┴───────────────┬──────────────────────┐
         ▼                      ▼                               ▼                      ▼
  [ 首页仪表盘 ]          [ 智能体管理 ]                  [ 任务干预监控 ]         [ 动态工具控制台 ] [NEW]
         │                      │                               │                      │
         │                      │                         (增加强制取消)         (CRUD / 调试沙箱)
         │                      │                               │                      │
         └──────────────┬───────┴───────────────┬───────────────┴──────────────────────┘
                        │ (ADMIN 鉴权请求)
                        ▼
               [ API 网关 Gateway ] 
                        │
                        ▼ (Service Bindings)
               [ 后端 Admin Worker ]
                        │
         ┌──────────────┼───────────────┬──────────────────────┐
         ▼                      ▼                               ▼
  [ 统计与时区对齐 ]     [ 审计日志读取 ] [NEW]            [ 动态工具 CRUD & 沙箱调试 ] [NEW]
```

### 外部依赖与安全性
* **Cloudflare Workers runtime**：使用 `new Function` 在 Admin Worker 中动态评估待测脚本，执行前对 `context.env` 进行安全隔离。
* **小程序分包管理**：在 `packageAdmin` 中新增 `tools` 文件夹，包含工具列表、详情编辑、自定义入参定义和调试控制台 WXML。

---

## 2. 核心契约与接口定义

### 2.1 后端接口追加 (Admin API)

1. **动态工具沙箱调试 (Online Sandbox Debug)**:
   * `POST /api/v1/admin/tools/debug`
   * **请求体**：
     ```typescript
     interface DebugToolReq {
       script: string;       // 待调试的 JS 代码
       input: Record<string, any>; // Mock 输入数据
     }
     ```
   * **响应体**：
     ```typescript
     interface DebugToolRes {
       success: boolean;
       data: {
         result: string;     // 脚本执行返回值
         durationMs: number; // 耗时
       };
       error?: string;       // 编译或执行期报错
     }
     ```

2. **获取审计日志列表 (Audit Log Query)**:
   * `GET /api/v1/admin/audit-logs`
   * **查询参数**：`limit` (分页限制，默认20), `offset` (偏移量), `action` (操作行为筛选), `targetId` (目标对象筛选)。
   * **响应体**：
     ```typescript
     interface AuditLogsRes {
       logs: Array<{
         id: number;
         adminId: string;
         action: string;
         targetId: string;
         detail: any;
         createdAt: string;
       }>;
     }
     ```

---

## 3. 控制流转与执行细节

### 3.1 沙箱调试执行机制 (`handleAdminDebugTool`)
在 `backend/workers/admin/src/handlers/tools.ts` 中增加调试处理器。在安全沙箱中执行自定义 JS 代码，防范全局变量逃逸和 CPU 阻塞（使用 `Promise.race` 与 `setTimeout` 进行 15s 熔断限制）。

### 3.2 微信小程序 packageAdmin 结构扩建
在 `frontend/packageAdmin/` 中，我们新增 `tools` 目录，并新增两个子页面：
1. **工具列表视图 (`packageAdmin/tools/index`)**：渲染动态工具卡片并支持启用/停用控制。
2. **工具编辑与沙箱调试视图 (`packageAdmin/tools/edit`)**：编写配置表单、等宽代码编辑文本域、以及调试参数输入黑窗。

---

## 4. 防御设计与安全控制
1. **安全沙箱隔离**：对环境变量脱敏，执行前对 `context.env` 进行安全过滤，禁止将线上生产数据库密钥和 AI 模型私钥暴露给调试沙箱。
2. **时区一致性**：将大盘本日新建任务等统计的时区偏置强校准为东八区（UTC+8），杜绝日期切换时导致的零点数据突变。
3. **取消防穿透**：修改任务列表“强制取消”点击冒泡，引入 `catchtap` 阻止微信小程序中点击按钮同时触发卡片详情跳转的事件穿透问题。
