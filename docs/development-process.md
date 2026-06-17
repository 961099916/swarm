# Swarm 开发流程规范

> 从 56 份架构决策记录 (ADR) 中提炼的全栈开发方法论
> 覆盖：需求分析 → 架构设计 → 编码执行 → 安全审计 → 归档交付

---

## 一、核心原则

### 1. ADR First

**任何有架构影响的变更，必须先写 ADR（架构决策记录），再写代码。**

ADR 不是事后文档，而是**编码前的强制设计审查环节**。它是设计文档、技术方案评审记录、架构演进史的三合一。

| 作用 | 说明 |
|------|------|
| 设计文档 | 明确模块归属、契约定义、控制流、防御设计 |
| 评审记录 | 挂起等待审批，确保方案经过审查 |
| 演进历史 | 记录为什么选择某方案，避免重复讨论 |

### 2. 契约驱动

**数据契约先行，实现随后。** 前后端接口、模块间 DTO、数据库 Schema 的 TypeScript 类型必须在编码前统一定义。

### 3. 业务技术分离

核心业务逻辑与底层技术实现物理隔离。Gateway 只做编排不做业务，Handler 只做流程不直接写 SQL。

---

## 二、三阶段开发生命周期

```
Phase 1 [架构与计划] ──→ 输出 LLD，挂起等待审批
         │
         ▼ 用户输入 "APPROVE"
Phase 2 [方案评审] ──→ 仅更新 LLD 和契约，不生成代码
         │
         ▼
Phase 3 [编码与执行] ──→ ADR 归档 → 严格编码
```

### Phase 1: 架构与计划 (Planning)

接到需求后，输出**底层设计文档 (LLD)**，必须包含以下 5 个部分：

#### 1.1 架构定位

| 要素 | 必须回答的问题 |
|------|---------------|
| 模块归属 | 变更发生在哪个 Worker/目录？ |
| 影响范围 | 涉及哪些外部依赖、数据库表、前端页面？ |
| 解耦设计 | 如何确保新增逻辑与现有架构正交？ |

_参考 ADR: gateway-design-pattern.md, tools-design-pattern.md, utils-design-pattern.md_

#### 1.2 核心契约

以 JSON Schema / TypeScript Interfaces / DTO 的形式，**先定义数据形状**。

```typescript
// 示例：来自 gateway-design-pattern ADR
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  traceId: string;
}

export interface RequestValidator<T = any> {
  validate(data: T): string | null;
}
```

_参考 ADR: gateway-handlers-refactoring.md, drizzle-orm-integration.md_

#### 1.3 控制流转与设计模式

用 **Mermaid 时序图** 描述核心流程，并**说明每个设计模式的选型理由**。

| 模式 | 适用场景 | 案例 ADR |
|------|----------|----------|
| **建造者 (Builder)** | 统一响应格式、HTTP 头封装 | gateway-design-pattern |
| **职责链 (Chain)** | 多规则参数校验 | gateway-design-pattern, auth-middleware |
| **策略 (Strategy)** | AI 模型白名单、工具路由 | tools-design-pattern |
| **模板方法 (Template)** | 工具执行骨架（日志+监控+校验） | tools-design-pattern |
| **注册表 (Registry)** | 动态工具查找与执行 | tools-design-pattern |
| **门面 (Facade)** | 兼容旧接口的平滑迁移 | tools-design-pattern |
| **工厂 (Factory)** | CC 转账上下文创建 | enterprise-refactoring |

_参考 ADR: gateway-design-pattern.md, tools-design-pattern.md, enterprise-refactoring.md_

#### 1.4 防御设计

列出 **3-5 种异常场景**，说明兜底策略和 TraceID 记录点：

| 异常场景 | 策略 | 日志级别 |
|----------|------|----------|
| JSON 解析崩溃 | try-catch → 400 Bad Request | ERROR + TraceID |
| 越权操作 | WHERE 条件严格限定 userId | WARN + TraceID |
| 外部 API 超时 | AbortSignal.timeout(15000) 熔断 | ERROR + TraceID |
| API Key 缺失 | 自动降级/模拟模式 | WARN |
| 数据库连接异常 | 重试 3 次后返回 503 | ERROR + 全堆栈 |

_参考 ADR: tools-design-pattern.md, gateway-design-pattern.md, admin-cache-consistency.md_

#### 1.5 执行拆解

拆解为极细粒度的 TODO List，每个 TODO 对应一个文件或一个函数。

---

### Phase 2: 方案评审 (Refinement)

- 仅更新 LLD 和契约
- 绝对不允许生成代码或调用运行环境
- 仅在确认 "APPROVE" 后进入 Phase 3

---

### Phase 3: 编码与执行 (Execution)

#### 步骤 3.1 — ADR 归档

将最终批准的 LLD 保存至：

```
docs/design_records/YYYY-MM-DD_feature-name.md
```

归档文件必须包含：
- 创建日期、状态（已批准）、作者
- 完整的架构定位、核心契约、控制流转
- 防御设计
- 文件命名缩写但语义完整（如 `admin-cache-consistency.md`）

#### 步骤 3.2 — 严格编码

遵循下面第四章的分层编码规范。

---

## 三、ADR 文档规范

### 3.1 文件命名

```
YYYY-MM-DD_short-description.md
```

- 日期使用实际创建日期
- 描述使用 kebab-case，保持简洁但语义完整
- 示例：`2026-06-16_gateway-design-pattern.md`

### 3.2 文档模板

```markdown
# 架构决策记录 (ADR) - 标题

* 创建日期: YYYY-MM-DD
* 状态: 已批准 (Approved)
* 作者: 首席全栈架构师

---

## 1. 架构定位
- **模块归属**: 所属 Worker 和目录
- **外部依赖**: 依赖的模块和服务
- **解耦设计**: 如何实现业务与技术分离

## 2. 核心契约
```typescript
// TypeScript Interfaces / DTO
```

## 3. 控制流转
```mermaid
sequenceDiagram
    // 核心流程时序图
```

### 设计模式选型理由
1. **模式名**: 为什么选择这个模式

## 4. 防御设计
1. **异常场景**: 策略说明
2. **异常场景**: 策略说明
3. **异常场景**: 策略说明
```

_参考 ADR: 仓库中 56 份 ADR 文件均遵循此模板_

---

## 四、分层编码规范

### 4.1 后端架构分层

```
gateway/                    # API 网关层
  ├── src/index.ts          # 路由注册 + 全局中间件
  ├── src/authMiddleware.ts # 鉴权拦截器（JWT + 版本校验）
  ├── src/creditsHelper.ts  # 积分变动助手
  ├── src/handlers/         # 业务处理器（仅编排，不含 SQL）
  │   ├── auth.ts           # 微信登录/登出
  │   ├── user.ts           # 用户资料
  │   └── tasks.ts          # 任务管理
  ├── src/utils/            # 工具层
  │   ├── response.ts       # ResponseBuilder（统一响应）
  │   ├── validator.ts      # ValidatorChain（校验链）
  │   ├── drizzle.ts        # Drizzle 查询帮助
  │   └── jwtHelper.ts      # JWT 签发与验证
  └── src/db/               # 数据库层（已逐步废弃，统一用 Drizzle）

user/                       # 用户微服务
engine/                     # 引擎微服务
admin/                      # 管理后台微服务
quiz/                       # 闯关评测微服务
workflow/                   # 工作流引擎
  ├── src/workflow.ts       # Workflow 主控
  ├── src/tools/            # 工具注册表
  │   ├── registry.ts       # ToolRegistry（注册表模式）
  │   ├── types.ts          # 工具接口契约
  │   └── dynamic-tool.ts   # 动态工具加载器
  └── src/utils.ts          # 辅助函数
```

**关键约束**：

| 约束 | 说明 | 违反后果 |
|------|------|----------|
| Gateway 不做业务 | 只做路由编排、鉴权、转发 | 架构耦合，难以拆分 |
| Handler 不写 SQL | 通过 Drizzle ORM 操作 | 安全风险，类型不安全 |
| Entity 不直接暴露 | DTO 转换后再返回 | 内部实现泄漏 |
| catch 不能吞异常 | 必须记录 TraceID 日志或向上抛 | 调试困难 |

### 4.2 设计模式应用

在 Phase 3 编码时，从以下已验证的模式库中选择：

| 场景 | 推荐模式 | ADR 参考 |
|------|----------|----------|
| HTTP 响应封装 | 建造者 (Builder) | gateway-design-pattern |
| 请求参数校验 | 职责链 (Chain of Responsibility) | gateway-design-pattern |
| 动态工具执行 | 注册表 (Registry) + 策略 (Strategy) | tools-design-pattern |
| 工具执行骨架 | 模板方法 (Template Method) | tools-design-pattern |
| 统一数据访问 | 数据访问对象 (DAO) | drizzle-orm-integration |
| 跨服务调用 | 门面 (Facade) | tools-design-pattern |

### 4.3 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| TypeScript 文件 | kebab-case | `auth-middleware.ts` |
| 函数/变量 | camelCase | `handleLogin`, `getCorsHeaders` |
| 类/接口/类型 | PascalCase | `TaskOrchestrator`, `UserRow` |
| 常量 | UPPER_SNAKE_CASE | `INITIAL_CREDITS`, `DEFAULT_MAX_LOOPS` |
| 环境变量 | UPPER_SNAKE_CASE | `JWT_SECRET`, `ALLOWED_ORIGIN` |
| SQL 表/列 | snake_case | `wx_open_id`, `token_version` |
| Drizzle 字段 | camelCase（映射到 snake_case） | `wxOpenId`, `tokenVersion` |
| 目录名 | kebab-case | `handlers/`, `utils/` |
| ADR 文件 | `YYYY-MM-DD_desc.md` | `2026-06-16_gateway-design-pattern.md` |

### 4.4 代码格式

- 2 空格缩进，禁止 Tab
- 行尾 LF，禁止 CRLF
- 文件末尾保留一个空行
- 语句末尾必须加分号
- 字符串统一使用双引号
- JSDoc 用于导出函数和模块

---

## 五、安全开发规范

### 5.1 数据库安全

| 原则 | 说明 |
|------|------|
| 禁止裸 SQL | 必须通过 Drizzle ORM 或预编译语句 |
| 参数绑定 | 所有变量通过 `bind()` 传入，禁止字符串拼接 |
| WHERE 限定 | 敏感操作必须加 `user_id = ?` 条件 |

```typescript
// ✅ 安全：Drizzle ORM
await db.update(users)
  .set({ credits: sql`credits + ${delta}` })
  .where(eq(users.id, userId));

// ✅ 安全：预编译语句
await db.prepare("UPDATE users SET credits = ? WHERE id = ?").bind(delta, userId);

// ❌ 禁止：字符串拼接
await db.prepare("UPDATE users SET credits = " + delta + " WHERE id = " + userId);
```

_参考 ADR: drizzle-orm-integration.md_

### 5.2 缓存安全

管理端写操作必须同步废弃网关缓存：

```typescript
// 管理员修改角色 → 废弃网关鉴权缓存
await CacheService.delete(kv, "user:auth:" + userId);

// 新建缓存带防穿透占位和防雪崩 Jitter
await CacheService.set(kv, key, value, ttlSeconds);
```

_参考 ADR: admin-cache-consistency.md_

### 5.3 日志安全

| 规则 | 说明 |
|------|------|
| 数据脱敏 | TraceLogger 自动过滤 password/token/secret/authorization 等字段 |
| 分级日志 | ERROR=业务中断、WARN=可恢复、INFO=核心状态、DEBUG=开发用 |
| TraceID 必带 | 每一条日志必须包含 traceId |
| 不打印机密 | 禁止打印完整 AI Prompt、批量用户数据 |

```typescript
TraceLogger.info("GATEWAY", "LOGIN_SUCCESS", traceId, "用户登录成功", userId);
TraceLogger.error("ADMIN", "BAN_USER_FAILED", traceId, "封禁失败", error, adminId);
```

_参考 ADR: enterprise-refactoring-and-optimization.md, auth-middleware-refactoring.md_

### 5.4 物理安全

- 内部 Worker 不直接对外暴露
- Gateway 与内部 Worker 之间通过 Service Binding + X-Internal-Key 双重校验
- 管理端操作记录审计日志

---

## 六、可观测性规范

### 6.1 TraceID 全链路透传

```
请求 → Gateway (crypto.randomUUID()) → 内部 Worker (Header 透传) → D1/KV/AI (日志携带)
```

### 6.2 日志级别红线

| 级别 | 使用场景 | 必须包含 |
|------|----------|----------|
| ERROR | 业务中断、需人工介入的故障 | TraceID + 完整异常堆栈 + 核心参数 |
| WARN | 可恢复异常、兜底策略触发 | TraceID + 事件 + 原因 |
| INFO | 核心业务状态流转 | TraceID + 事件 + 关键数据 |
| DEBUG | 开发调试参数 | 生产默认关闭 |

### 6.3 跨 Worker 调用链路

```
Gateway (traceId=A) → Engine SVC (traceId=A) → D1 (traceId=A)
                                        → Workflow API (traceId=A)
```

所有日志中搜索同一个 TraceID 即可还原完整请求链路。

_参考 ADR: enterprise-refactoring-and-optimization.md_

---

## 七、数据库开发流程

### 7.1 新增一张表的步骤

```
第1步：backend/packages/shared/src/schema.ts
  → 用 Drizzle ORM 定义表结构（sqliteTable）
第2步：backend/packages/shared/src/types.ts
  → 定义 Row 类型接口
第3步：backend/schema.sql
  → 同步 DDL 语句（用于初始化/迁移）
第4步：docs/database/README.md
  → 更新数据库文档
```

### 7.2 Drizzle 字段映射规范

```typescript
// schema.ts 中
export const users = sqliteTable("users", {
  wxOpenId: text("wx_open_id").notNull(),  // camelCase → snake_case
  tokenVersion: integer("token_version").default(1),
});

// 查询时返回的也是 camelCase
const user = await db.select().from(users).where(eq(users.id, id));
// user.wxOpenId ✅  user.wx_open_id ❌
```

### 7.3 事务边界

积分、余额等敏感操作必须使用 D1 事务：

```typescript
await db.transaction(async (tx) => {
  await tx.update(users).set({ credits: sql`credits + ${delta}` }).where(...);
  await tx.insert(creditsLedger).values({ userId, delta, balance, ... });
});
```

_参考 ADR: enterprise-refactoring-and-optimization.md, drizzle-orm-integration.md_

---

## 八、前端开发规范

### 8.1 架构演进

Swarm 前端经历了显著的技术演进，ADR 中完整记录了每个转折点：

| 阶段 | 架构 | ADR 参考 |
|------|------|----------|
| 初始 | UniApp + Vue3 + TailwindCSS | `uni-ui-tailwindcss-refactor.md` |
| 进化 | 原生小程序 + TDesign 组件库 | `migration-to-native-miniprogram.md` |
| 当前 | 原生小程序 + SPA 架构 + TDesign | `spa-refactor.md` |
| 主题 | 深色主题 + 蓝紫双轨色系 | `enterprise-ui-restructuring.md` |

### 8.2 前端开发约束

- 仅保留 UI 渲染、状态管理、本地缓存
- 所有业务请求通过 `utils/request.ts` 统一封装
- 401 自动跳登录页，403 弹窗提示
- 禁止在前端暴露后端密钥或 Token
- 重复的状态转换逻辑抽取到共享 helper

### 8.3 UI 设计原则

| 原则 | 来源 ADR |
|------|----------|
| 深色基础色 #070B14，#0D1526 | `enterprise-ui-restructuring.md` |
| 蓝紫双轨色系 #1677FF + #722ED1 | `enterprise-ui-restructuring.md` (Ant Design 5.x) |
| 玻璃卡材质 backdrop-filter | `spa-refactor.md` |
| TDesign 三层透明度体系 | `enterprise-ui-restructuring.md` |
| SPA 单页面避免白屏闪烁 | `spa-refactor.md` |
| 像素艺术 TabBar | `tabbar-pixel-art-upgrade.md` |

_参考 ADR: 前端相关 20+ 份 ADR 完整记录了 UI 演进史_

---

## 九、Git 工作流

### 9.1 分支策略

```
master          ← 生产就绪分支
  ├── feat/*    ← 新功能分支
  ├── fix/*     ← 修复分支
  ├── refactor/*← 重构分支
  ├── docs/*    ← 文档分支
  └── chore/*   ← 工具/配置分支
```

_参考 ADR: 所有 ADR 的 git commit 历史体现此模式_

### 9.2 提交规范

```
<type>(<scope>): <subject>

<body>
```

| Type | 含义 | 示例 |
|------|------|------|
| feat | 新功能 | `feat(gateway): 添加缓存双写失效逻辑` |
| fix | 修复 Bug | `fix(quiz): 修复闯关评分计算溢出` |
| refactor | 重构 | `refactor(workflow): 迁移到注册表模式` |
| style | 代码风格 | `style(admin): 格式化审批流代码` |
| docs | 文档变更 | `docs: 补充开源文档` |
| chore | 工具/配置 | `chore: 升级 Wrangler 版本` |
| security | 安全修复 | `security: 修复鉴权缓存延迟漏洞` |

### 9.3 与 ADR 的关系

每次重要提交应关联对应的 ADR：

```
feat(gateway): 实现鉴权缓存双写失效

关联 ADR: docs/design_records/2026-06-17_admin-cache-consistency.md
```

---

## 十、ADR 索引

### 按模块分类

| 模块 | ADR 数量 | 关键 ADR |
|------|----------|----------|
| **后端架构** | 5 | `gateway-design-pattern.md`, `optimize-architecture.md`, `enterprise-refactoring-and-optimization.md` |
| **网关** | 3 | `gateway-handlers-refactoring.md`, `auth-middleware-refactoring.md`, `admin-cache-consistency.md` |
| **工作流引擎** | 7 | `agent-orchestrator.md`, `tools-design-pattern.md`, `utils-design-pattern.md` |
| **数据库** | 3 | `drizzle-orm-integration.md`, `global-drizzle-integration.md`, `dynamic-database-tools.md` |
| **工具系统** | 5 | `tools-design-pattern.md`, `batch-import-uapis-tools.md` |
| **前端 UI** | 22 | `enterprise-ui-restructuring.md`, `spa-refactor.md`, `enterprise-ui-redesign.md` |
| **安全** | 2 | `auth-middleware-refactoring.md`, `admin-cache-consistency.md` |
| **AI** | 2 | `llama-upgrade.md`, `llama32-upgrade.md` |
| **主题/图标** | 6 | `theme-switching-system.md`, `tabbar-pixel-art-upgrade.md` |
| **其他** | 3 | `clean-up-bak-files.md`, `alibaba-spec-refactoring.md` |

### 按时间线

```
2026-06-15 → 1 ADR (首个 Agent 编排设计)
2026-06-16 → 39 ADRs (大规模重构: Drizzle ORM, Gateway 规范化, 工具模式, UI 体系)
2026-06-17 → 16 ADRs (微服务拆分, 缓存一致, 动态工具, 企业级重构)
```

---

## 十一、常见场景速查

| 场景 | 执行步骤 | 参考文档 |
|------|----------|----------|
| 新增 API 端点 | ADR → 定义 DTO → Handler → ResponseBuilder | `gateway-design-pattern.md` |
| 新增数据库表 | Schema → Types → SQL DDL → 文档 | `drizzle-orm-integration.md` |
| 新增工具 | Tool Schema → 注册 Registry → 沙箱测试 | `tools-design-pattern.md` |
| 新增 Agent | ADR → Agent 表 → 编排逻辑 → UI | `agent-orchestrator-refactor.md` |
| 安全修复 | ADR → 缓存/鉴权更新 → 审计日志 | `admin-cache-consistency.md` |
| UI 变更 | ADR → 主题/组件 → 原生小程序页面 | `enterprise-ui-restructuring.md` |
| 新增微服务 | ADR → wrangler.toml → Service Binding | `enterprise-refactoring-and-optimization.md` |

---

## 十二、附录：ADR 设计模式速查表

从 56 份 ADR 中提取的设计模式总结：

| 模式 | 频次 | 应用场景 | 典型文件 |
|------|------|----------|----------|
| 建造者 (Builder) | ★★★★★ | HTTP 响应统一封装 | `utils/response.ts` |
| 职责链 (Chain) | ★★★★★ | 请求参数多规则校验 | `utils/validator.ts` |
| 策略 (Strategy) | ★★★★ | 工具路由/模型选择/降级 | `tools/registry.ts` |
| 模板方法 (Template) | ★★★★ | 工具执行骨架 | `tools/registry.ts` |
| 注册表 (Registry) | ★★★★ | 动态工具查找 | `tools/registry.ts` |
| 门面 (Facade) | ★★★ | 旧接口兼容 | `workflow.ts` |
| 数据访问对象 (DAO) | ★★★ | 数据库操作封装 | `utils/drizzle.ts` |
| 单例 (Singleton) | ★★ | 全局配置/注册表 | `tools/registry.ts` |
| 状态机 (State) | ★★ | 任务状态流转 | `workflow.ts` |

---

_本文档由 56 份 ADR 综合提炼而成。每个设计决策的完整上下文请查阅对应的 ADR 文件。_
_最后更新: 2026-06-17_
