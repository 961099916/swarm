# API 参考

## 概述

所有 API 通过 Gateway (swarm-gateway) 暴露，前缀为 `/api`。

### 基础地址

| 环境 | 地址 |
|------|------|
| 本地开发 | `http://localhost:8787` |
| 生产 | `https://api.yourdomain.com` |

### 统一响应格式

所有 API 返回统一的 JSON 结构：

```typescript
interface ApiResponse<T = any> {
  success: boolean;       // 是否成功
  data?: T;              // 响应数据（成功时）
  error?: string;        // 错误消息（失败时）
  traceId?: string;      // 全链路追踪 ID
}
```

### 认证

大多数接口需要在 Header 中携带 JWT Token：

```
Authorization: Bearer <jwt_token>
X-Trace-Id: <trace_id>    // 可选，用于全链路追踪
```

### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或 Token 过期 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 请求频率限制 |
| 500 | 服务器内部错误 |

---

## 认证 API

### POST /api/auth/login — 微信登录

使用微信临时 code 登录，如果用户不存在则自动注册。

**请求体**:

```json
{
  "code": "wx_code",
  "inviterId": "optional_inviter_id"
}
```

**成功响应**:

```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "userId": "user_id",
    "role": "FREE_USER"
  },
  "traceId": "..."
}
```

### POST /api/auth/logout — 退出登录

**请求体**:

```json
{}
```

---

## 用户 API

### GET /api/user/profile — 获取用户信息

**响应**:

```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "nickname": "昵称",
    "avatarUrl": "https://...",
    "role": "FREE_USER",
    "credits": 100,
    "invitedBy": "inviter_id"
  }
}
```

### PUT /api/user/profile — 更新用户信息

**请求体**:

```json
{
  "nickname": "新昵称",
  "avatarUrl": "https://..."
}
```

### GET /api/user/credits — 获取积分流水

**查询参数**: `?page=1&limit=50`

**响应**:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "delta": 50,
        "balance": 100,
        "reason": "INITIAL",
        "createdAt": "..."
      }
    ],
    "total": 1
  }
}
```

---

## Agent API

### GET /api/agents — 获取 Agent 列表

### POST /api/agents — 创建 Agent

**请求体**:

```json
{
  "name": "My Agent",
  "systemPrompt": "你是...",
  "model": "@cf/meta/llama-3.1-8b-instruct-fp8",
  "tools": ["tool_id_1", "tool_id_2"]
}
```

### PUT /api/agents/:id — 更新 Agent

### DELETE /api/agents/:id — 删除 Agent

---

## 任务 API

### POST /api/tasks — 创建任务

**请求体**:

```json
{
  "taskType": "AGENT_ORCHESTRATION",
  "payload": {
    "agentId": "agent_id",
    "input": "任务描述"
  }
}
```

### GET /api/tasks — 获取任务列表

**查询参数**: `?page=1&limit=20&status=RUNNING`

### GET /api/tasks/:id — 获取任务详情

### GET /api/tasks/:id/logs — 获取任务日志

---

## 管理后台 API

> 需要 ADMIN 角色

### GET /api/admin/stats — 获取系统统计

### GET /api/admin/users — 获取用户列表

**查询参数**: `?page=1&limit=20&search=keyword&role=FREE_USER`

### PUT /api/admin/users/:id/role — 修改用户角色

**请求体**:

```json
{
  "role": "VIP_USER"
}
```

### POST /api/admin/users/:id/credits — 调整积分

**请求体**:

```json
{
  "delta": 100,
  "reason": "ADJUST"
}
```

### POST /api/admin/users/:id/ban — 封禁/解封用户

**请求体**:

```json
{
  "isBanned": true,
  "reason": "违规行为"
}
```

### POST /api/admin/users/:id/invalidate-token — 强制下线

---

## 闯关评测 API

### GET /api/quiz/stages — 获取关卡列表

### GET /api/quiz/stages/:id — 获取关卡详情

### POST /api/quiz/stages/:id/submit — 提交答案

### GET /api/quiz/progress — 获取用户闯关进度

---

## 健康检查

### GET /health

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0"
  }
}
```
