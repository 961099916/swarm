## 描述

请简要描述这个 PR 的内容和动机。

关联 Issue: #{issue_number}

## 类型

- [ ] feat: 新功能
- [ ] fix: Bug 修复
- [ ] refactor: 重构（不改变外部行为）
- [ ] style: 代码风格（格式化、命名）
- [ ] docs: 文档
- [ ] test: 测试
- [ ] chore: 工具/配置
- [ ] security: 安全修复
- [ ] perf: 性能优化

## 检查清单

### 代码质量
- [ ] 已通过 `make check`（lint + type-check + test）
- [ ] 新增代码有对应的单元测试（测试覆盖率未下降）
- [ ] 无 `console.log` / `debugger` 残留
- [ ] 无 `any` 类型滥用（禁止新增 `: any`）
- [ ] 所有错误处理使用 `getErrorMessage()` 而非直接 `error.message`

### 安全
- [ ] 无明文 Secret / Token 提交
- [ ] 无 SSRF 风险（所有外部 URL 经过校验）
- [ ] 无 SQL 注入风险（使用 Drizzle ORM 参数化查询）

### 数据一致性
- [ ] 积分/资产变更操作使用 `db.transaction()` 而非 `db.batch()`
- [ ] 数据库变更同步到 `schema.sql` 和 `types.ts`

### 文档
- [ ] 新 API 已更新 `docs/openapi.yaml`
- [ ] 架构变更已更新 `docs/design_records/` ADR

## 测试结果

```
# 请粘贴 make check 的输出
```

## 部署说明

- [ ] 需要执行数据库迁移
- [ ] 需要更新环境变量
- [ ] 需要更新 wrangler.toml
