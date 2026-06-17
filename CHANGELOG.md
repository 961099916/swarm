# Swarm 开发记录

> 项目从零到开源的完整演进史
> 时间跨度: 2026-06-15 ~ 2026-06-17 | 3 天迭代 | 15 次提交 | 56 份 ADR

---

## 项目概览

| 指标 | 数值 |
|------|------|
| 开发周期 | 3 天 |
| Git 提交 | 15 次 |
| 架构决策记录 (ADR) | 56 份 |
| 源代码文件 | 288 个 |
| 代码行数 | +34,888 / -7,876 |
| 后端微服务数 | 6 个 (gateway, user, engine, admin, quiz, workflow) |
| 前端页面数 | 10+ 个 (主包 6 页 + 分包 5 页) |
| 数据库表 | 10+ 张 |
| 设计模式 | 9 种 |

---

## 一、时间线总览

```
06-15 ── 1 ADR ──→ 种子：Agent 编排器设计
    │
06-16 ── 42 ADRs + 初始提交 ──→ 大规模重构日
    │    ├── 后端：微服务架构、Drizzle ORM、Gateway 设计模式
    │    ├── 工作流：Agent 编排、工具注册表、LLM 升级
    │    ├── 前端：UniApp→原生小程序、SPA 架构、TDesign 迁移
    │    └── UI：深色主题、像素艺术、企业级视觉体系
    │
06-17 ── 12 ADRs + 13 次提交 ──→ 企业级强化日
         ├── 微服务拆分：User/Engine 独立 Worker
         ├── 可观测性：TraceLogger、CacheService
         ├── 缓存一致：管理员操作 → KV 缓存失效
         ├── 动态工具：数据库驱动的工具注册表
         └── 开源准备：文档体系搭建
```

---

## 二、阶段一：种子设计 (06-15)

### 单颗种子

| ADR | 内容 |
|-----|------|
| `06-15_agent-orchestrator.md` | 多 Agent 协同编排首次设计，定义了 Supervisor-Workers 模式和边缘微工具集 |

这是整个项目的设计起点，确立了：
- **Supervisor 调度模式**：主管 Agent 分解任务 → 子 Agent 执行 → 汇总
- **边缘工具集**：web_fetch、email_notify、llm_refinement
- **三位一体微服务**：gateway、admin、workflow 的初版分工

---

## 三、阶段二：大规模重构 (06-16)

这是项目最密集的开发日，**42 份 ADR + 初始代码提交**，覆盖了从后端架构到前端 UI 的全方位重构。

### 3.1 初始代码库 (c0a4837)

```
Initial commit: 57 个文件, 10,105 行
├── backend/workers/gateway/    ← 初始网关
├── backend/workers/admin/      ← 初始管理后台
├── backend/workers/workflow/   ← 初始工作流引擎
├── frontend/                   ← UniApp + Vue3 前端
└── docs/                       ← 空目录
```

### 3.2 后端架构重构 (12 ADRs)

| 时间 | ADR | 重构内容 | 设计模式 |
|------|-----|----------|----------|
| 06-16 | `optimize-architecture.md` | 全局架构优化 | — |
| 06-16 | `gateway-design-pattern.md` | Gateway 规范化：ResponseBuilder、ValidatorChain | 建造者 + 职责链 |
| 06-16 | `gateway-handlers-refactoring.md` | 全部 Handler 阿里规约化 | 职责链 + 门面 |
| 06-16 | `auth-middleware-refactoring.md` | 鉴权中间件重构 | 门面 |
| 06-16 | `drizzle-orm-integration.md` | Drizzle ORM 替代裸 SQL | 数据访问对象 |
| 06-16 | `global-drizzle-integration.md` | 全 Worker 统一 Drizzle Schema | 单数据源 |
| 06-16 | `alibaba-spec-refactoring.md` | 阿里规约物理隔离 | — |

**关键决策**：全面采用 Drizzle ORM，在 `packages/shared` 中统一 Schema 定义，所有 Worker 共享同一份类型安全的数据库层。

### 3.3 工作流引擎重构 (8 ADRs)

| 时间 | ADR | 重构内容 | 设计模式 |
|------|-----|----------|----------|
| 06-16 | `agent-orchestrator-refactor.md` | Agent 编排引擎升级 | Supervisor-Workers |
| 06-16 | `agent-management.md` | Agent 管理后端 | — |
| 06-16 | `agent-management-refinement.md` | Agent 管理细化 | — |
| 06-16 | `tools-design-pattern.md` | 工具层：ToolRegistry | 策略 + 模板方法 + 注册表 |
| 06-16 | `utils-design-pattern.md` | 工具函数层：清洗、日志 | 模板方法 + 职责链 |
| 06-16 | `workflow-obs-and-model-upgrade.md` | 可观测性 + 模型升级 | — |
| 06-16 | `llama-upgrade.md` | Llama 3 → Llama 3.1 | — |
| 06-16 | `llama32-upgrade.md` | → Llama 3.2 | — |

**关键决策**：
- **注册表模式**：工具不再硬编码在 if-else 中，而是注册到 ToolRegistry，按名称动态查找执行
- **模板方法**：BaseWorkflowTool 定义执行骨架（日志+监控+校验），子类只实现 `run()`
- **LLM 升级**：一路从 Llama 3 → 3.1 → 3.2

### 3.4 前端架构重构 (22 ADRs)

前端经历了大规模技术演进：

```
UniApp + Vue3        UniApp + TailwindCSS   原生小程序 + TDesign    SPA 架构
────────────────►  ────────────────────►  ─────────────────────►  ──────────►
  初始                   06-16 上午            06-16 下午            06-16 晚间
```

#### 第一阶段：UniApp 移除 (4 ADRs)

| ADR | 变更 |
|-----|------|
| `uni-ui-tailwindcss-refactor.md` | 移除 UniApp 的 uni-ui，迁移至 TailwindCSS |
| `spa-refactor.md` | 废弃原生 TabBar，实现 SPA 单页面架构消除闪烁 |
| `migration-to-native-miniprogram.md` | 从 UniApp 迁移至微信原生小程序 |
| `native-miniprogram-pages-migration.md` | 逐页面迁移至原生 |

#### 第二阶段：UI 视觉体系 (8 ADRs)

| ADR | 变更 |
|-----|------|
| `enterprise-ui-restructuring.md` | 深色主题+蓝紫双轨色系(#1677FF+#722ED1)，TDesign 三层透明度 |
| `enterprise-ui-upgrade.md` | UI 规范升级 |
| `theme-switching-system.md` | 主题切换系统 |
| `stardew-valley-colors.md` | 像素艺术配色 |
| `optimize-color-theme.md` | 色彩体系优化 |
| `pixel-art-theme-upgrade.md` | 像素艺术主题升级 |
| `tabbar-pixel-art-upgrade.md` | TabBar 像素艺术化 |
| `tabbar-theme-icons.md` | TabBar 主题图标 |

#### 第三阶段：TDesign 迁移 (6 ADRs)

| ADR | 变更 |
|------|------|
| `replace-emojis-to-tdesign-icons.md` | 用 TDesign 图标替换 Emoji |
| `tdesign-font-local-base64.md` | TDesign 字体 Base64 本地化 |
| `deprecate-t-icon-component.md` | 废弃自定义图标组件 |
| `fix-agent-manager-icon.md` | Agent 管理器图标修复 |
| `fix-service-icon-and-readability.md` | 服务图标可读性修复 |
| `change-agent-manager-icon.md` | Agent 管理器图标更换 |

#### 第四阶段：页面完善 (4 ADRs)

| ADR | 变更 |
|------|------|
| `detail-page-refactor.md` | 详情页重构 |
| `one-click-deployment.md` | 一键部署页面 |
| `final-result-ui-showcase.md` | 最终结果 UI 展示 |
| `optimize-package-size.md` | 分包优化 |

### 3.5 其他 (2 ADRs)

| ADR | 内容 |
|-----|------|
| `sass-api-modern-migration.md` | 弃用 @import 改用 @use/@forward |
| `sass-modern-compiler-upgrade.md` | Dart Sass 编译器升级 |

### 3.6 对应 Git 提交

06-16 日没有新的 git 提交（除了 initial），所有代码变更都在 06-17 的 `d1eca08` 和 `69a27b8` 两个大提交中落地。

---

## 四、阶段三：企业级强化 (06-17)

**12 份 ADR + 13 次 Git 提交**，这是代码密集产出的阶段。

### 4.1 第一波：工作流夯实 (提交 2-5)

| # | 提交 | 内容 |
|---|------|------|
| 2 | `d1eca08` | 工具 Schema 动态生成 + Supervisor 修复 + 全链路日志 |
| 3 | `69a27b8` | 全量提交：后端重构 + 前端迁移 + 基建 |
| 4 | `9aeb61f` | 删除内联 Facade，全面改用 ToolRegistry |
| 5 | `fb26236` | result_summary 输出真实数据而非仅摘要 |

### 4.2 第二波：Bug 修复 (提交 6-7)

| # | 提交 | 修复内容 |
|---|------|----------|
| 6 | `f6542b6` | Drizzle 驼峰字段 vs 前端蛇形字段不一致 |
| 7 | `1ae0cc5` | 头像 R2 上传、昵称保存、NPC ID 匹配、正确率计算 |

### 4.3 第三波：UAPI 工具系统 (提交 8-11)

| # | 提交 | 内容 |
|---|------|------|
| 8 | `06260dd` | 数据库驱动的 UAPI 工具架构，92 个工具 |
| 9 | `c046433` | 表名修复：uapi_tools → tools |
| 10 | `e7044e9` | Revert 表名修复 |
| 11 | `e0a3e67` | Revert 整个 UAPI 工具提交 |

> 这三次来回操作（提交 → 修复 → 两次 Revert）反映了工具系统架构决策的反复权衡。

### 4.4 第四波：企业级重构 (提交 12-13)

| # | 提交 | 内容 |
|---|------|------|
| 12 | `3dc6cbd` | update |
| 13 | `1e459d9` | **企业级可观测性重构 + 缓存一致性 + 微服务拆分** |

对应的 ADR：

| ADR | 内容 | 设计模式 |
|-----|------|----------|
| `enterprise-refactoring-and-optimization.md` | DDD 限界上下文拆分：6 个 Worker | — |
| `admin-cache-consistency.md` | 管理操作 → 网关缓存强一致失效 | 缓存双写 |
| `tool-schema-dynamic-generation.md` | 工具参数 Schema 动态生成 | 工厂 |
| `dynamic-database-tools.md` | 数据库驱动的动态工具 | 注册表 |
| `compatibility-of-dynamic-tool-fields.md` | 动态工具字段兼容性 | — |
| `batch-import-uapis-tools.md` | 92 个 UAPI 工具批量导入 | — |
| `weather-query-agent-seed.md` | 天气查询 Agent 种子 | — |
| `fix-workflow-finalize-summary-priority.md` | 工作流结果汇总优先级修复 | — |
| `migrate-weather-query-to-api-proxy.md` | 天气查询迁移到 API Proxy | — |
| `admin-control-panel-complete.md` | 管理后台控制面板完整化 | — |
| `enterprise-ui-redesign.md` | 企业级 UI 重新设计 | — |
| `ui-tokenization-and-style-unification.md` | UI Token 化与样式统一 | 设计令牌 |

### 4.5 架构演进：从 3 到 6 个微服务

```
06-16 初始:          06-17 重构后:
┌──────────┐        ┌──────────┐
│  Gateway  │        │  Gateway  │
├──────────┤        ├──────────┤
│  Admin    │        │  User     │ ← 新增
├──────────┤        ├──────────┤
│  Workflow │        │  Engine   │ ← 新增
└──────────┘        ├──────────┤
                    │  Admin    │
                    ├──────────┤
                    │  Quiz     │ ← 新增
                    ├──────────┤
                    │  Workflow │
                    └──────────┘
```

**关键决策**：采用 DDD 限界上下文拆分，但关键事务（积分扣减）保持物理同库强一致性，避免分布式事务复杂性。

### 4.6 技术栈定型

从本次提交最终确定的技术栈：

| 领域 | 最终技术 | 演进路径 |
|------|----------|----------|
| 运行时 | Cloudflare Workers | — |
| Web 框架 | Hono | — |
| ORM | Drizzle ORM | 裸 SQL → Drizzle |
| 数据库 | D1 (SQLite) | — |
| 缓存 | KV + CacheService | 无缓存 → KV → Jitter 防雪崩 |
| 日志 | TraceLogger | console.log → 结构化日志 |
| 工作流 | Cloudflare Workflows | — |
| AI 推理 | Workers AI (LLaMA 3.1) | Llama 3 → 3.1 → 3.2 → 3.1 |
| 前端 | 微信原生小程序 + TDesign | UniApp+Vue3 → 原生+TDesign |
| 架构 | SPA + 深色主题 | Tab 原生 → SPA；亮色 → 深色 |
| 语言 | TypeScript strict | — |

### 4.7 文档阶段 (提交 14-15)

| # | 提交 | 内容 |
|---|------|------|
| 14 | `a11b8f0` | 开源文档：README、SECURITY、API、架构、部署 |
| 15 | `d479092` | 从 56 份 ADR 提炼开发流程规范 |

---

## 五、架构决策模式分析

### 5.1 设计模式使用频率

| 模式 | 使用次数 | 典型场景 |
|------|----------|----------|
| 建造者 (Builder) | 5 | HTTP 响应封装 |
| 职责链 (Chain) | 4 | 参数校验 |
| 策略 (Strategy) | 4 | 工具路由、模型选择 |
| 模板方法 (Template) | 3 | 工具执行骨架 |
| 注册表 (Registry) | 3 | 动态工具查找 |
| 门面 (Facade) | 2 | 兼容旧接口 |
| 数据访问对象 (DAO) | 2 | 数据库封装 |
| 单例 (Singleton) | 1 | 全局注册表 |
| 状态机 (State) | 1 | 任务状态流转 |

### 5.2 安全决策演进

```
06-16 裸 SQL                   → 经过预编译语句防护
06-16 Drizzle ORM 引入          → 编译期类型安全
06-16 JWT 鉴权                  → 基础认证
06-16 Service Binding + Key     → 物理隔离
06-17 缓存双写失效               → 消除安全时间窗口
06-17 TraceLogger 数据脱敏       → 日志安全
06-17 Token 版本校验             → 强制下线能力
06-17 审计日志                   → 操作可追溯
```

### 5.3 可观测性演进

```
06-16 console.log        → 基础日志
06-16 TraceID 透传       → 全链路追踪
06-17 TraceLogger        → 结构化日志 + 分级(DEBUG/INFO/WARN/ERROR)
06-17 数据脱敏            → 自动过滤敏感字段
06-17 缓存命中率          → 性能观测
06-17 Workers Observability → 平台级监控
```

---

## 六、工程数据

### 6.1 提交统计

| 指标 | 数值 |
|------|------|
| 总提交数 | 15 |
| 参与作者 | 1 人 (zhangjiahao) |
| 首次提交 | 2026-06-16 |
| 末次提交 | 2026-06-17 |
| 活跃开发时长 | ~3 天 |
| 最大单次变更 | 288 文件, +34,888 / -7,876 (69a27b8) |

### 6.2 文件类型分布 (最终)

```
TypeScript     ████████████████  40%+
JSON           ██████            15%
WXML/WXSS      ██████            15%
Markdown       ████              10% (文档 + ADR)
SQL            ██                5%
Shell          █                 2%
Other          ██                13%
```

### 6.3 ADR 主题分布

| 主题 | ADR 数 | 占比 |
|------|--------|------|
| 前端 UI/主题 | 22 | 39% |
| 后端架构 | 8 | 14% |
| 工作流引擎 | 7 | 13% |
| 工具系统 | 5 | 9% |
| 前端迁移 | 4 | 7% |
| 数据库 | 3 | 5% |
| 网关/鉴权 | 3 | 5% |
| 安全 | 2 | 4% |
| AI 模型 | 2 | 4% |

---

## 七、关键转折点

1. **Drizzle ORM 引入** — 从裸 SQL 到编译期类型安全，消除了运行期 SQL 错误
2. **注册表模式** — 工具从 if-else 地狱解耦为即插即用
3. **原生小程序迁移** — 从 UniApp 的跨平台抽象回到微信原生，获得更好的性能和 TDesign 组件库
4. **SPA 架构** — 消除了 TabBar 切换的白屏闪烁，提升了用户体验
5. **微服务拆分** — 从 3 个 Worker 到 6 个，实现了领域限界上下文
6. **缓存一致性** — 消除了管理端操作到网关缓存的安全时间窗口
7. **TraceLogger** — console.log → 结构化可观测性

---

## 八、文件增长趋势

```
Initial commit:  57 文件   10,105 行
提交 2-12:      288 文件   34,888+ / 7,876- 行
提交 13:        +43 文件   3,498+ / 410- 行
提交 14-15:     +18 文件   2,630+ / 298- 行

最终代码库:     ~288 文件   ~42,000+ 行 (估算)
```

---

_本文档由 Git 提交历史 + 56 份 ADR 自动综合生成_
_生成日期: 2026-06-17_
