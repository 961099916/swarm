# 管理后台

## 概述

Admin Worker 是 Swarm 的管理后台微服务，为管理员提供用户管理、Agent 管理、任务监控和审计日志功能。仅接受来自 Gateway 的内部 Service Binding 请求。

## 功能模块

### 仪表盘

系统概览，展示：
- 用户总数
- 任务总数及状态分布
- 积分总量
- 近期的关键活动

### 用户管理

| 操作 | 说明 | 安全措施 |
|------|------|----------|
| 用户列表 | 分页查询，支持搜索和角色过滤 | — |
| 角色修改 | 升级/降级用户角色 | 自动废弃网关鉴权缓存 |
| 积分调整 | 手动增减用户积分 | 事务性写入 + 审计日志 |
| 封禁/解封 | 控制用户账号状态 | 自动废弃网关鉴权缓存 |
| 强制下线 | 使 Token 失效 | Token 版本增加 + 缓存清理 |

### Agent 管理

| 操作 | 说明 |
|------|------|
| Agent 列表 | 查看所有已注册 Agent |
| Agent 配置 | 编辑名称、提示词、模型 |
| Agent 启停 | 启用/禁用 Agent |

### 任务监控

- 查看所有任务及其状态
- 查看任务日志
- 支持分页和状态过滤

### 审计日志

所有管理操作记录审计日志，包含：
- 操作管理员 ID
- 操作类型
- 操作目标
- 操作详情 (JSON)
- 操作时间

## 安全架构

### 双重校验

Admin Worker 通过 `X-Internal-Key` + `X-User-Role` 双重校验：
1. Internal Key 匹配确保请求来自 Gateway
2. 用户角色为 ADMIN 确保有管理权限

### 缓存一致性

管理操作（角色修改、封禁、强制下线）自动废弃 Gateway 的 KV 鉴权缓存，防止因缓存未失效而出现安全延迟漏洞：

```typescript
// 管理员修改角色后同步失效网关缓存
await CacheService.delete(kv, "user:auth:" + userId);

// 更新 Token 版本
await db.update(users)
  .set({ tokenVersion: sql`token_version + 1` })
  .where(eq(users.id, userId));
```

## API 端点

详见 [API 参考](/docs/api/README.md#管理后台-api)。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/stats | 系统统计 |
| GET | /api/admin/users | 用户列表 |
| PUT | /api/admin/users/:id/role | 修改角色 |
| POST | /api/admin/users/:id/credits | 调整积分 |
| POST | /api/admin/users/:id/ban | 封禁操作 |
| POST | /api/admin/users/:id/invalidate-token | 强制下线 |
| GET | /api/admin/tasks | 任务列表 |
| GET | /api/admin/agents | Agent 列表 |

## 相关 ADR

- [缓存一致性方案](/docs/design_records/2026-06-17_admin-cache-consistency.md)
- [管理后台控制面板](/docs/design_records/2026-06-17_admin-control-panel-complete.md)
- [企业级 UI 重构](/docs/design_records/2026-06-17_enterprise-ui-redesign.md)
