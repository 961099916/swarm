# Architecture Decision Record (ADR) - 评测配置由 JSON 字段升级为结构化关系表设计

**日期**: 2026-06-21
**作者**: Antigravity
**状态**: Approved (已批准)

---

## 1. 架构定位
- **所属模块**: 评测关卡题库微服务 (Swarm Quiz Services)
- **解耦逻辑**:
  - 数据存储层由原先将配置串包装在 `system_configs` 的大 JSON 结构，升级为清晰的关系数据模型。
  - 保留微服务向前端暴露的 `GET/PUT` 关卡配置路由契约（保证前端极简/流畅的交互不受破坏性更改影响）。
  - 后端接收到热更新 JSON 后，在事务中物理清洗、转换并写入结构化三张表中。
  - 闯关评估与题库拉取逻辑从这三张关系表关联查询拼接，保证业务完全结构化存储。

---

## 2. 核心契约与数据库 Schema 设计

### 2.1 数据库迁移 (Migration SQL)
#### [NEW] [006_quiz_structural_configs.sql](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/migrations/006_quiz_structural_configs.sql)
在 D1 数据库中创建这三张物理表：
```sql
-- 1. 测评年级关卡主表
CREATE TABLE IF NOT EXISTS quiz_stages (
  id TEXT PRIMARY KEY,               -- 例如: kindergarten_1, primary_1
  name TEXT NOT NULL,                -- 例如: 幼儿园小班
  stage_group TEXT NOT NULL,         -- 例如: kindergarten, primary
  stage_order INTEGER NOT NULL,      -- 排序权值
  updated_at TEXT
);

-- 2. NPC 导师挑战配置表
CREATE TABLE IF NOT EXISTS quiz_npcs (
  id TEXT PRIMARY KEY,               -- 例如: npc_kg1_math
  stage_id TEXT NOT NULL,            -- 关联 quiz_stages.id
  name TEXT NOT NULL,                -- 例如: 小班算术导师 小红老师
  npc_type TEXT NOT NULL,            -- 例如: math, language, general
  subject_name TEXT NOT NULL,        -- 例如: 数学, 语文
  required_score INTEGER NOT NULL,   -- 通关所需分数
  dialogue_locked TEXT NOT NULL,     -- 锁定状态对话
  dialogue_todo TEXT NOT NULL,       -- 挑战中状态对话
  dialogue_passed TEXT NOT NULL,     -- 通关后状态对话
  updated_at TEXT
);

-- 3. NPC 旗下题库表
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY,            -- 题目全局独立整型 ID
  npc_id TEXT NOT NULL,              -- 关联 quiz_npcs.id
  question_text TEXT NOT NULL,       -- 题干
  options TEXT NOT NULL,             -- 选项 (JSON 数组序列化存储，如 [{"id":"A","text":"3朵"}])
  correct_id TEXT NOT NULL,          -- 正确选项 ID (如 'A')
  explanation TEXT,                  -- 错题解析说明
  updated_at TEXT
);
```

---

### 2.2 Drizzle ORM Schema 升级
#### [MODIFY] [packages/quiz/src/schema.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/packages/quiz/src/schema.ts)
在 `schema.ts` 中增补这三张表对应的 ORM 强类型实体定义：
- `quizStages`: 映射 `quiz_stages` 表。
- `quizNpcs`: 映射 `quiz_npcs` 表。
- `quizQuestions`: 映射 `quiz_questions` 表。

---

## 3. 控制流转与数据同步机制

### 3.1 题库加载与降级控制流
当系统拉取关卡配置或评估答题时：
1. 优先从三张关系表中查询所有 Stage、NPC 以及 Questions 数据并进行结构嵌套组装。
2. **初始化兜底与降级**: 如果关系表无数据（如刚部署升级的空白数据库），`QuizService` 将自动运行一次迁移初始化动作，将代码中硬编码的默认 `STAGE_CONFIGS` 刷入关系数据库中，并触发缓存更新，确保老用户无感过渡。

### 3.2 配置热更新事务数据流
管理员在后台修改 JSON 提交热重载时：
1. `updateQuizConfigs` 接收关卡配置数组。
2. 开启 `Drizzle Transaction`（事务保证一致性）。
3. 物理执行 `DELETE` 彻底清除老旧配置：
   - 清空 `quiz_stages`、`quiz_npcs`、`quiz_questions` 三张表。
4. 遍历 JSON 数据结构，格式化清洗后，顺序 `INSERT` 写入新数据。
5. 事务提交成功后，清除 Redis/KV 缓存。

---

## 4. 防御与安全设计
1. **多表一致性事务**: 清空旧配置与插入新配置一律约束在单次 `Drizzle Transaction` 中。如果在写入新题目时出错，事务整体回滚，不破坏旧数据。
2. **关联删除级联处理**: 因 D1 SQLite 缺乏原生复杂的 FK Cascade 支持（需手动开启 PRAGMA），我们统一在应用层事务中手动按 `questions` -> `npcs` -> `stages` 的次序进行安全删除。
3. **数据格式化健壮性**: 在对 `options` (选项列表) 字段进行 JSON 存储 and 解析时，利用 `try-catch` 包裹，防止因非法脏数据导致整个题库页面崩溃。
