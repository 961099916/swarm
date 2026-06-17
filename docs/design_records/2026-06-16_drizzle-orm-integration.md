# 架构决策记录 (ADR) - 数据库持久层安全防护与 Drizzle ORM 整合演进方案

* 创建日期: 2026-06-16
* 状态: 已批准 (Approved)
* 作者: 首席全栈架构师

---

## 1. 架构定位
- **模块归属**: 数据库持久化层 (`backend/workers/gateway/src/db/` & `backend/packages/shared/`)。
- **解耦设计**:
  - **解耦 SQL 字符串与代码**：利用 ORM 的对象关系映射，不再在代码中手写 SQL 字符串，全面对齐 TypeScript 编译期强类型检查。
  - **统一 Schema 源 (SSOT)**：由 Drizzle `schema.ts` 统一声明表定义，自动生成 Drizzle 强类型客户端，避免 SQL 字段拼写错误在运行期才暴露的技术债。

---

## 2. 🛡️ 安全解答：当前直接写 SQL 会出现 SQL 注入吗？

### 2.1 结论
**目前的实现方案下，绝对不会发生 SQL 注入。**

### 2.2 防护原理分析
SQL 注入的成因是**把用户输入的脏数据，直接拼接在 SQL 指令字符串中**（如 `"SELECT * FROM users WHERE name = " + input`），导致脏数据被数据库当做 SQL 命令解析树的一部分去执行。

而在我们的重构代码中，全量采用了 Cloudflare D1 提供的**预编译语句与参数绑定 (Prepared Statements & Parameter Binding)**：
```typescript
await db
  .prepare("UPDATE users SET credits = credits + ?, updated_at = ? WHERE id = ?")
  .bind(delta, now, userId)
```
- 数据库底层在执行时，会将 SQL 指令（即带有 `?` 的结构）先送往解析器进行命令树解析与锁定。
- 随后，`bind(...)` 中的变量仅会被作为纯字面量（Literal Value）填入占位符中，**无论变量中包含何种恶意 SQL 指令，均会被严格视为普通字符串，不会被执行**。因此在安全性上是完全合规且防御式的。

---

## 3. ORM 框架选型及 Drizzle 整合方案

尽管预编译 SQL 没有安全风险，但大厂生产系统往往因为**缺乏编译期类型校验、拼写困难及无法捕获位置偏移异常**等问题，极力推崇使用 **Drizzle ORM**。

### 3.1 核心契约：Drizzle Schema 定义 (`src/db/schema.ts`)
我们使用 Drizzle ORM 的 SQLite 方言定义核心表结构：

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  wxOpenId: text('wx_open_id').notNull().unique(),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['FREE_USER', 'VIP', 'ADMIN'] }).default('FREE_USER').notNull(),
  credits: integer('credits').default(0).notNull(),
  tokenVersion: integer('token_version').default(1).notNull(),
  isBanned: integer('is_banned').default(0).notNull(),
  bannedReason: text('banned_reason'),
  invitedBy: text('invited_by').references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  avatar: text('avatar').default('🤖').notNull(),
  role: text('role').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  model: text('model').notNull(),
  tools: text('tools').default('[]').notNull(),
  isPreset: integer('is_preset').default(0).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```
