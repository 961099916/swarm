# File: docs/design_records/2026-06-21_global-admin-rpc-upgrade.md

# 架构决策记录 - 全局管理后台扩展与分布式 RPC 控制流设计

- **状态**: 已接受
- **日期**: 2026-06-21
- **决策者**: 首席全栈架构师 & 架构评审官

## 背景
随着 Swarm 系统在用户、智能体、RAG、Quiz 等模块的业务深化，现有的 Admin 管理端出现了管理盲区：
1. **RAG 文档失控**: 无法全局审查或强制下线违规的用户上传文档，且文档删除需要级联清空 D1 数据库和 Cloudflare Vectorize 向量索引。
2. **Quiz 配置硬编码**: 测评关卡与题目参数硬编码在 Quiz 代码中，无法动态调整。
3. **资金与裂变审计缺位**: 缺乏全局广告刷分和裂变奖励的明细账目监控。

为了将这些模块的安全管控纳入后台，同时保持系统高内聚低耦合的分布式隔离特征，需要设计出一套优雅、安全的管理拓展与 RPC 交互方案。

## 决策
1. **强行禁止跨服务数据库写操作**: `Admin Worker` 不得直接注入 RAG/Quiz 的 Schema 或直接访问其数据库。
2. **服务绑定 RPC 控制流**: `Admin Worker` 必须通过 `Service Binding`（微服务内部网络）向 `RAG Worker` 和 `Quiz Worker` 发送受控的 `/api/v1/internal/admin/*` 内部 HTTP 请求。
3. **安全物理校验 (Security Shield)**: 所有内部 RPC 路由强制实施 `X-Internal-Key` 鉴权，且必须在 Request Header 中携带 `X-Trace-Id` 实现可观测性的全链路 Trace 透传。
4. **管线控制闭环自理**:
   - **RAG 模块**: 独立负责清空 D1/KV 文档数据以及级联擦除 Cloudflare Vectorize。
   - **Quiz 模块**: 将硬编码关卡改由 `system_configs` 驱动，并提供缓存失效机制以实现热更。

## 后果
- **正面**:
  - 管理后台实现了对 RAG、Quiz、Credits 等业务的 100% 深度掌控。
  - 各模块数据逻辑高内聚，任意模块变更存储介质不会波及 Admin 端。
- **负面**:
  - 增加了微服务之间的内网控制流 RPC 依赖。若 RAG 或 Quiz 挂掉，可能会短暂导致 Admin 端相关页面出现局部降级，需要增加超时（Circuit Breaker）防御。
