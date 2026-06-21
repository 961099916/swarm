# 底层设计文档 (LLD) - TypeScript 微服务 Monorepo 全局 DDD 架构与代码规范重构方案

根据方案评审意见，我们决定将重构范围扩大至整个 Swarm 项目的全部微服务模块与公共依赖域。本方案将作为全局重构的顶级技术设计，参考 SpringBoot 代码规范与 Alibaba 开发规范，对本系统的 TypeScript/Cloudflare Workers Monorepo 进行全局四层领域驱动设计(DDD)及防腐层(ACL)改造。

---

## 1. 全局架构蓝图 (Global DDD Blueprint)

我们将全系统拆分为两大层级: API 接口表现层 (对应各个物理 workers/ 微服务) 与 公共限界上下文域 (对应各 packages/ 共享业务包)，各包内部实现严格的四层架构分工:

- backend/workers/: 用户接口表现层 (Controller Layer)
  - gateway: 统一网关，负责安全过滤、TraceID 注入与路由分发
  - user: 对应 IdentityFacade 与 CreditsFacade 接口
  - agent: 对应 AgentFacade 与 TaskFacade 接口
  - quiz: 对应 QuizFacade 接口
  - rag: 对应 KnowledgeFacade 与 SearchFacade 接口

- backend/packages/: 核心业务领域包 (Core Domain Packages)
  - kernel: 系统核心设施 (全局异常、错误码、统一返回 ApiRes)
  - ai-gateway: AI 调用防腐层 (ACL)，隔离 Workers AI/OpenAI 流式网络物理细节
  - identity: 身份认证域
  - credits: 算力积分域
  - agent: 智能体与协同引擎域
  - quiz: 测评域
  - knowledge: 知识库与 RAG 域

---

## 2. 全局限界上下文四层物理拆包规范

重构后，packages/ 目录下的每个业务包都必须符合以下统一的目录结构:

- packages/domain_name/src/
  - facade/: 接口门面层 (定义 DTO / VO 契约与 Facade 服务)
    - dto/: XXXQueryDTO / XXXCommandDTO 入参封装
    - vo/: XXXVO / XXXDTO 出参封装
    - facade.ts: 微服务 Controller 调用的唯一强类型入口
  - application/: 应用服务层 (流程编排、分布式事务、消息发送)
    - service/: XXXApplicationService
  - domain/: 领域层 (纯业务逻辑，不依赖具体技术实现)
    - model/: 聚合根与值对象 (采用充血模型，内聚校验断言)
    - service/: 跨聚合的领域服务 (DomainService)
    - repository/: 仓储契约接口 (IXXXRepository)
  - infrastructure/: 基础设施层 (底层数据库读写与物理调用)
    - repository/: 仓储实现 (D1XXXRepository / SQL 物理存储)
    - acl/: 针对第三方/外部系统的防腐层实现

---

## 3. 分限界上下文详细设计 (Domain-Specific Designs)

### 3.1 packages/identity (身份认证限界上下文)
- 领域层:
  - 聚合根 User: 定义用户等级权限规则、个人昵称头像规范断言。
  - 仓储契约 IUserRepository。
- 应用层:
  - 服务 IdentityApplicationService: 处理微信登录的事务编排、用户数据初始化。
- 基础设施层:
  - 防腐层 WxAuthAcl: 封装对微信官方接口的物理 HTTP 网络请求，将微信返回的异构数据模型转换为系统内部 User 模型。
  - D1UserRepository: 实现 IUserRepository，屏蔽底层 Drizzler/D1 DDL。
- 门面层:
  - UserVO: 定义传给小程序的脱敏用户对象，严禁泄露微信 openid。
  - WxLoginCommandDTO: 登录入参强校验。

### 3.2 packages/credits (算力积分限界上下文)
- 领域层:
  - 聚合根 CreditsLedger: 内聚积分额度加减法断言，判断算力是否不足、限制负值积分并生成积分日志流水。
- 应用层:
  - 服务 CreditsApplicationService: 编排扣减算力、启动任务、广告完成加积分、邀请关联加积分的记账防刷事务逻辑。
- 门面层:
  - CreditsLedgerVO、AdRewardCommandDTO。

### 3.3 packages/agent (智能体与协同上下文)
- 领域层:
  - 聚合根 Agent: 定义智能体模型路由合法性断言，校验提示词变量占位符。
  - 聚合根 CollaborativeTask: 任务生命周期状态机管理(PENDING -> RUNNING -> SUCCESS/FAILED)，限制最大 Loops 轮数。
  - 值对象 AgentTool: 工具元数据。
  - 仓储契约 IAgentRepository、ITaskRepository。
- 应用层:
  - 服务 TaskOrchestrationService: 多智能体分布式协作执行流，调用 ai-gateway 驱动协作循环。
- 门面层:
  - CreateAgentReq、CreateTaskReq、TaskVO。

### 3.4 packages/quiz (测评限界上下文)
- 领域层:
  - 聚合根 QuizUser: 内聚 EXP 经验升级公式、不同 NPC 通关判断逻辑。
- 应用层:
  - 服务 QuizApplicationService: 保存测评记录、同步更新关卡经验和触发等级晋升事务。
- 门面层:
  - SubmitQuizReq、QuizProgressVO。

---

## 4. 全局公共设施重构

### 4.1 全局错误码 (ErrorCode) 与异常治理
在 packages/kernel 中定义标准错误码体系，分类清晰:
- 1000 - 1999: RAG/知识库异常 (如 KNOWLEDGE_BASE_NOT_FOUND = 1030)
- 2000 - 2999: 身份认证与用户异常 (如 USER_NOT_FOUND = 2001, INVALID_TOKEN = 2002)
- 3000 - 3999: 算力积分异常 (如 INSUFFICIENT_CREDITS = 3001)
- 4000 - 4999: 智能体与编排异常 (如 TASK_LOOP_OVERFLOW = 4001, AGENT_NOT_FOUND = 4002)

定义全局通用业务异常类 BusinessException。微服务 Controller 的 onError 统一拦截 BusinessException，将 ErrorCode 与 TraceID 格式化响应返回，杜绝在 Controller/Service 中拼接魔术字符串进行异常判定。

### 4.2 统一 AI 访问防腐层 (packages/ai-gateway ACL)
- 定义 IAiService 仓储式接口，供 RAG 问答、协同引擎调用。
- 封装 chatStream 与 generateEmbeddings 的底层网络通信，处理 Done 信号拼接。
- 将 Cloudflare Workers AI 或是未来 OpenAI API 的网络异常全部在 ACL 内部翻译为 BusinessException(ErrorCode.AI_SERVICE_UNAVAILABLE)，保证外部接口变动零污染业务层。

### 4.3 全局系统配置动态化与热更新服务 (packages/kernel ConfigService)
- 底层技术选型:
  - 系统配置统一存放在 SQLite system_configs 物理表中 (结构为 key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)。
  - 在 packages/kernel 中封装强类型的 ConfigService。
- 动态读缓存与热更新机制:
  - 动态读取: 通过 ConfigService.get(db, key) 或 getNumber / getBoolean 获取。
  - 防穿透与本地内存缓存: 在 ConfigService 中维护一个带 10s TTL 的 Isolate 级别内存 Map 缓存。在多 Agent 协作工作流或并发 RAG 检索中防高频查库。
  - 强类型 Fallback 机制: 当数据库表中配置缺失或 D1 查询异常时，自动回退到代码中硬编码的全局 DEFAULT_CONFIGS 映射字典，保证系统健壮性。
  - 热更新与同步:
    - 管理端通过 API 写入新配置到 system_configs 表中。
    - Isolate 级别的本地内存缓存将在 10 秒内自动过期，从而安全、轻量地实现秒级热更新，无需引入复杂的发布订阅服务。
- 可动态配置的参数清单:
  - 算力积分域: INITIAL_CREDITS (新用户赠送), INVITE_REWARD (邀请奖励), AD_REWARD (广告奖励), TASK_COST (启动任务消耗)。
  - 知识库与 RAG 域: RAG_DEFAULT_CHUNK_SIZE (分块大小), RAG_DEFAULT_CHUNK_OVERLAP (重叠度), RAG_DEFAULT_TOP_K (Top-K 检索数), RAG_DEFAULT_MIN_SCORE (匹配阈值), RAG_MAX_CONTEXT_LENGTH (上下文最大长度), RAG_MAX_FILE_SIZE (最大上传文件字节数), DEFAULT_EMBED_MODEL (嵌入模型名称)。
  - 工作流协同域: DEFAULT_MAX_LOOPS (主控最大循环轮数), DEFAULT_MODEL (默认大模型路由)。
  - 测评域: EXP_PER_LEVEL (升级经验基底), QUIZ_PASS_THRESHOLD (通关分数阈值), EXP_STAGE_PASS (通关奖励经验), EXP_QUIZ_COMPLETE (测评奖励经验), EXP_QUIZ_CALCULATE (计分奖励经验)。

### 4.4 全链路 TraceID 穿透与结构化日志脱敏规范
- **全链路 TraceID 穿透**:
  - Hono Gateway 中间件提取或生成全局唯一的 `traceId`，存储于 `c.set("traceId", traceId)`。
  - 调用共享包 Facade 服务及 ApplicationService 时，所有业务方法签名均强制要求显式传入 `traceId`（如 `getUserInfo(userId, traceId)`），实现跨层链路物理绑定。
  - 对于微服务间出站 HTTP 调用（如 Admin 访问 RAG），强制在 Headers 中透传 `X-Trace-Id`。
- **敏感数据脱敏过滤器**:
  - 在 `packages/kernel` 的 `TraceLogger` 中内置数据清洗脱敏插件（Data Masking Filter）。
  - 在序列化日志 Payload 时，自动对敏感键（如 `wx_open_id`、`code`、`session_key`、`token`、`password`）的值进行正则表达式掩码替换为 `******`。
  - **日志分级原则**: 严格遵守日志级别界限。除 `DEBUG` 级外，禁止在 `INFO` 级日志中打印大体积的 Raw Prompt 文本或完整 DB Response 结果，防物理日志系统存储溢出。

### 4.5 端到端 TraceID 穿透与前端异常容灾闭环设计
- **请求拦截器 (Request Interceptor) 注入**:
  - 微信小程序与 Admin 端的网络请求拦截器，在发送每个 API 请求前，自动在 Header 中添加 `X-Trace-Id`（如无则在端侧生成唯一 UUID 并缓存，有则沿用）。
- **统一响应拦截器 (Response Interceptor) 处理**:
  - 重构响应拦截逻辑，统一解构后端 `ApiRes`。当遇到 HTTP 状态异常或业务 `code` 报错时，提取 `message` 和 `traceId`。
- **UI 容灾提示与一键复制 TraceID**:
  - 当接口报错或发生运行时崩溃时，UI 层弹出友好报错提示，并显式展示 `TraceID: xxxxxxxx` 伴随“复制”按钮，方便用户或管理员向技术人员提供精确定位凭证。
- **全局 JS 未捕获异常处理**:
  - 微信小程序配置 `App.onError` 捕获运行时崩溃；Admin 引入 React/Vue 的 `ErrorBoundary`，遇到严重前端渲染错误时，渲染友好灾难页并上报至 Cloudflare 日志中心。

---

## 5. 执行计划与模块治理步骤 (Todo List)

### 5.1 【步骤 3.1】 全局核心与异常防腐设施重构
- [ ] 在 packages/kernel 中实现强类型 ErrorCode 枚举和 BusinessException 异常封装。
- [ ] 在 packages/kernel 中实现强类型 ConfigService 动态配置拉取与 Isolate 内存缓存服务。
- [ ] 升级 packages/kernel 中的 TraceLogger，引入结构化脱敏过滤器（Masking Filter）及全链路 `traceId` 穿透标准。
- [ ] 重构 packages/ai-gateway，抽象为标准的 IAiService 防腐接口，隔离 Workers AI 的底层 API。

### 5.2 【步骤 3.2】 限界上下文重构 (业务包物理拆分与 DDD 分层)
- [ ] 重构 packages/identity: 提取领域实体 User 与 WxAuthAcl。将底层表结构 Schema 移动至 infrastructure/db/schema.ts。
- [ ] 重构 packages/credits: 建立算力账户聚合与领域扣减逻辑。将原本写死的 constants.ts 改造为调用 ConfigService 的动态注入逻辑。将底层表结构 Schema 移动至 infrastructure/db/schema.ts。
- [ ] 重构 packages/knowledge: 拆分为 domain、application、infrastructure 三层。将分块大小、检索 Top-K 等常数重构为从 ConfigService 动态读取。将底层表结构 Schema 移动至 infrastructure/db/schema.ts。
- [ ] 重构 packages/agent: 将智能体与 CollaborativeTask 状态机迁移至领域层。将底层表结构 Schema 移动至 infrastructure/db/schema.ts。
- [ ] 重构 packages/quiz: 规范化测评与关卡升级业务逻辑。将经验升级公式及通关阈值接入 ConfigService。将底层表结构 Schema 移动至 infrastructure/db/schema.ts。

### 5.3 【步骤 3.3】 微服务接口表现层规范化治理
- [ ] 改造 workers/rag、workers/user、workers/agent、workers/quiz:
  - [ ] 引入 hono/validator 和 zod 进行强类型 DTO 入参转换与校验绑定。
  - [ ] 消除 Controller 内的所有魔术字符串判断。
  - [ ] 接入 ExceptionInterceptor，统一异常返回。
- [ ] 改造 workers/admin 后台管理微服务:
  - [ ] 新增 GET /api/v1/admin/configs: 获取当前系统全部可配置项的 D1 存储值 (缺省则显示回退值)。
  - [ ] 新增 PUT /api/v1/admin/configs: 修改指定系统参数值至 system_configs 物理表中以支持热更新。
- [ ] 统一部署并执行 tsc --noEmit 进行全系统编译校验。

### 5.4 【步骤 3.4】 前端与管理端端到端 Trace 闭环重构
- [ ] 改造微信小程序 `frontend/mini-program` 的底层请求库，自动在请求头中生成并携带 `X-Trace-Id`。
- [ ] 改造小程序全局异常捕获 `App.onError`，实现报错时提供 TraceID 复制和静默日志上报。
- [ ] 重构 Admin 管理端的 Axios/fetch 请求库，接入响应拦截器以统一解构 `BusinessException` 的错误响应。
- [ ] 在 Admin 后台提供“开发者 Trace 链路查询”看板，支持根据前端 TraceID 实时拉取对应的后端 Cloudflare 日志。

---

## 6. 验证计划 (Verification Plan)

### 6.1 静态类型检查
- 在 backend 根目录运行 pnpm -r run type-check (或在全模块下执行 tsc --noEmit)，保证全项目重构后的强类型契约无 any 泄漏。

### 6.2 单元测试
- 编写对于 CreditsLedger、CollaborativeTask 及 QuizUser 关卡升级公式的领域单元测试。
- 对 ConfigService 进行单元测试，模拟 D1 查询失败时是否能正确 Fallback 至代码缺省值，以及 10s 本地内存过期缓存的正确性。
- 执行 pnpm test 全面跑通断言逻辑。

---

## 7. 架构设计决策确认 (Confirmed Architecture Decisions)

按照首席架构师的评审规范，我们在 Phase 2 评审中已就以下设计达成共识，并在此实施计划中予以确立:

1. **Drizzle Schema 物理位置**: Drizzle Schema 物理实体定义全部移动到各包内部的基础设施层 `infrastructure/db/schema.ts` 目录中。微服务及上层逻辑必须通过 Facade 层调用，严格禁止直接跨包导入并使用 schema 物理实体。
2. **Controller 入参校验框架**: 统一引入 `zod` 与 `hono/validator` 绑定，在 Hono 接口表现层进行强类型 DTO 约束，并抛出带有全局 TraceID 的结构化校验错误，达到企业级规范。
3. **动态配置内存缓存的 TTL 机制**: Isolate 级别的本地内存缓存 TTL 正式确立为 `10秒`。该方案能够以极低开销实现微服务节点的近实时热更新（最高 10 秒一致性延迟），无需使用外部的强同步机制。
