# 数据库 Schema

## 概览

使用 Cloudflare D1 (SQLite) 作为主数据库。通过 Drizzle ORM 操作，所有表定义集中在 `backend/packages/shared/src/schema.ts`。

## 表结构

### 1. users — 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 用户 ID (UUID) |
| wx_open_id | TEXT | NOT NULL, UNIQUE | 微信 OpenID |
| nickname | TEXT | | 昵称 |
| avatar_url | TEXT | | 头像 URL |
| role | TEXT | DEFAULT 'FREE_USER' | 角色: FREE_USER / VIP_USER / ADMIN |
| credits | INTEGER | DEFAULT 0 | 积分余额 |
| token_version | INTEGER | DEFAULT 1 | Token 版本（用于强制下线） |
| is_banned | INTEGER | DEFAULT 0 | 是否封禁 |
| banned_reason | TEXT | | 封禁原因 |
| invited_by | TEXT | | 邀请人 ID |
| created_at | TEXT | NOT NULL | 创建时间 |
| updated_at | TEXT | NOT NULL | 更新时间 |

### 2. role_permissions — 角色权限表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO INCREMENT | ID |
| role | TEXT | NOT NULL | 角色 |
| resource | TEXT | NOT NULL | 资源名称 |
| action | TEXT | NOT NULL | 操作权限 |

### 3. tasks — 任务表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 任务 ID (UUID) |
| user_id | TEXT | NOT NULL, FK→users.id | 用户 ID |
| task_type | TEXT | NOT NULL | 任务类型 |
| status | TEXT | DEFAULT 'PENDING' | 状态: PENDING/RUNNING/COMPLETED/FAILED |
| payload | TEXT | NOT NULL | 任务参数 (JSON) |
| workflow_run_id | TEXT | | Workflows Run ID |
| credits_cost | INTEGER | DEFAULT 0 | 消耗积分 |
| result_summary | TEXT | | 结果摘要 (JSON) |
| created_at | TEXT | NOT NULL | 创建时间 |
| updated_at | TEXT | NOT NULL | 更新时间 |

### 4. task_logs — 任务日志表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO INCREMENT | ID |
| task_id | TEXT | NOT NULL, FK→tasks.id | 任务 ID |
| level | TEXT | DEFAULT 'INFO' | 日志级别 |
| message | TEXT | NOT NULL | 日志内容 |
| created_at | TEXT | NOT NULL | 创建时间 |

### 5. credits_ledger — 积分流水表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO INCREMENT | ID |
| user_id | TEXT | NOT NULL, FK→users.id | 用户 ID |
| delta | INTEGER | NOT NULL | 变动值（正/负） |
| balance | INTEGER | NOT NULL | 变动后余额 |
| reason | TEXT | NOT NULL | 变动原因 |
| created_at | TEXT | NOT NULL | 创建时间 |

### 6. audit_logs — 审计日志表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PK AUTO INCREMENT | ID |
| admin_id | TEXT | NOT NULL | 管理员 ID |
| action | TEXT | NOT NULL | 操作类型 |
| target_id | TEXT | | 操作目标 ID |
| details | TEXT | | 操作详情 (JSON) |
| created_at | TEXT | NOT NULL | 创建时间 |

### 7. agents — Agent 配置表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | Agent ID (UUID) |
| user_id | TEXT | NOT NULL, FK→users.id | 所属用户 |
| name | TEXT | NOT NULL | Agent 名称 |
| system_prompt | TEXT | | 系统提示词 |
| model | TEXT | | 模型名称 |
| tools | TEXT | | 工具列表 (JSON) |
| is_active | INTEGER | DEFAULT 1 | 是否启用 |
| created_at | TEXT | NOT NULL | 创建时间 |
| updated_at | TEXT | NOT NULL | 更新时间 |

### 8. tools — 工具注册表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PK | 工具 ID |
| name | TEXT | NOT NULL | 工具名称 |
| description | TEXT | | 工具描述 |
| schema | TEXT | NOT NULL | JSON Schema |
| handler | TEXT | NOT NULL | 处理函数 |
| is_active | INTEGER | DEFAULT 1 | 是否启用 |
| created_at | TEXT | NOT NULL | 创建时间 |
| updated_at | TEXT | NOT NULL | 更新时间 |

### 9. system_configs — 系统配置表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| key | TEXT | PK | 配置键 |
| value | TEXT | NOT NULL | 配置值 |
| updated_at | TEXT | NOT NULL | 更新时间 |

## ER 关系

```
users ───< tasks
users ───< credits_ledger
users ───< agents
users ───< audit_logs (as admin_id)
tasks ───< task_logs
```

## 索引

- users.wx_open_id — UNIQUE
- tasks.user_id — 用户任务查询
- credits_ledger.user_id — 用户积分流水查询
- audit_logs.admin_id — 管理员操作审计查询

## 常量表

| 常量 | 值 | 说明 |
|------|-----|------|
| INITIAL_CREDITS | 50 | 新用户注册赠送积分 |
| INVITE_REWARD | 50 | 邀请奖励积分 |
| AD_REWARD | 20 | 广告激励积分 |
| TASK_COST | 5 | 创建任务消耗积分 |
| TOKEN_EXPIRY_DAYS | 7 | JWT 过期天数 |
| DEFAULT_MAX_LOOPS | 5 | 工作流最大循环轮数 |
| QUIZ_PASS_THRESHOLD | 0.6 | 闯关通过分数占比 |

## 查询示例

### Drizzle ORM

```typescript
import { users, tasks } from "@swarm/shared";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

const db = drizzle(D1DB);

// 查询用户及其任务
const result = await db
  .select()
  .from(users)
  .leftJoin(tasks, eq(users.id, tasks.userId))
  .where(eq(users.id, userId));
```

### SQL

```sql
-- 查询用户积分流水
SELECT * FROM credits_ledger
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT 50;

-- 统计各状态任务数
SELECT status, COUNT(*) as count
FROM tasks
WHERE user_id = ?
GROUP BY status;
```
