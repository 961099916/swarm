# 架构决策记录 (ADR) 索引

> 本项目使用 Architecture Decision Records (ADR) 记录关键架构决策。
> 每条 ADR 记录一个决策的上下文、方案和后果。

## 活跃记录

| 日期 | 标题 | 状态 | 领域 |
|------|------|------|------|
| 2026-06-16 | [网关设计模式](design_records/2026-06-16_gateway-design-pattern.md) | ✅ 已实施 | 架构 |
| 2026-06-16 | [动态工具注册表架构](design_records/2026-06-16_tools-design-pattern.md) | ✅ 已实施 | 引擎 |
| 2026-06-17 | [缓存一致性方案](design_records/2026-06-17_admin-cache-consistency.md) | ✅ 已实施 | 缓存 |
| 2026-06-17 | [企业级重构方案](design_records/2026-06-17_enterprise-refactoring-and-optimization.md) | ✅ 已实施 | 架构 |

## 新增记录

| 日期 | 标题 | 状态 | 领域 |
|------|------|------|------|
| 2026-06-17 | [积分原子性与事务选型](design_records/2026-06-17_credits-transaction.md) | ✅ 已实施 | 数据一致性 |
| 2026-06-17 | [API 统一响应协议](design_records/2026-06-17_api-response-protocol.md) | ✅ 已实施 | API |
| 2026-06-17 | [速率限制方案](design_records/2026-06-17_rate-limiting.md) | ✅ 已实施 | 安全 |
| 2026-06-17 | [错误处理策略](design_records/2026-06-17_error-handling.md) | ✅ 已实施 | 可靠性 |

## ADR 模板

```markdown
# [标题]

- **状态**: [提议中|已接受|已实施|已废弃]
- **日期**: YYYY-MM-DD
- **决策者**: @jiuxia

## 背景

## 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| A | ... | ... |
| B | ... | ... |

## 决策

选择方案 A。

## 后果

- 正面：...
- 负面：...
- 迁移：...
```
