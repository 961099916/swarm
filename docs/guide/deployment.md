# 部署指南

## 架构概览

所有 Worker 部署到 Cloudflare 边缘网络。前端为微信小程序，部署到微信服务平台。

## 前置条件

- Cloudflare 账号（已开启 Workers Paid 计划以使用 Workflows）
- 微信小程序账号
- Wrangler CLI 已登录

## 数据库初始化

```bash
# 创建生产 D1 数据库
wrangler d1 create swarm-db-prod

# 执行 schema
wrangler d1 execute swarm-db-prod --file=backend/schema.sql

# 更新 wrangler.toml 中的 database_id
```

## Secrets 注入

项目提供了 `init_secrets.sh` 一键注入脚本：

```bash
chmod +x backend/init_secrets.sh
./backend/init_secrets.sh
```

脚本会：

1. 自动生成 32 字节随机 JWT_SECRET 和 INTERNAL_SECRET
2. 交互式输入微信 AppSecret
3. 通过 Wrangler 非交互式注入到所有 Worker

### 手动注入 Secrets

```bash
# 网关
cd backend/workers/gateway
wrangler secret put JWT_SECRET
wrangler secret put INTERNAL_SECRET
wrangler secret put WX_APP_ID
wrangler secret put WX_APP_SECRET
wrangler secret put ALLOWED_ORIGIN

# 其他 Worker
cd ../user
wrangler secret put INTERNAL_SECRET
cd ../engine
wrangler secret put INTERNAL_SECRET
cd ../admin
wrangler secret put INTERNAL_SECRET
cd ../quiz
wrangler secret put INTERNAL_SECRET
```

## 部署 Worker

### 部署顺序（按依赖关系）

```bash
# 1. 数据层 Worker（无外部依赖）
cd backend/workers/user && npm run deploy
cd backend/workers/engine && npm run deploy
cd backend/workers/admin && npm run deploy
cd backend/workers/quiz && npm run deploy

# 2. 工作流引擎
cd backend/workers/workflow && npm run deploy

# 3. 网关（最后部署，依赖所有 Service Binding）
cd backend/workers/gateway && npm run deploy
```

### 验证部署

```bash
# 检查 Worker 状态
curl https://swarm-gateway.<your-subdomain>.workers.dev/health

# 查看日志
wrangler tail
```

## Service Binding 配置

确保所有 Worker 的 `wrangler.toml` 中 Service Binding 名称正确：

```toml
# gateway/wrangler.toml
[[services]]
binding = "CORE_SVC"
service = "swarm-user"

[[services]]
binding = "ENGINE_SVC"
service = "swarm-engine"

[[services]]
binding = "ADMIN_SVC"
service = "swarm-admin"

[[services]]
binding = "QUIZ_SVC"
service = "swarm-quiz"
```

## 域名绑定

```bash
# 绑定自定义域名
wrangler routes deploy --route "api.yourdomain.com/*" --zone-id <zone_id>
```

## 前端部署

使用微信开发者工具：
1. 填入 AppID
2. 设置 `utils/request.js` 中的 API base URL 为生产环境域名
3. 上传代码到微信小程序平台
4. 提交审核

## 监控

### 可观测性

每个 Worker 启用 Cloudflare Workers Observability：

```toml
# wrangler.toml
[observability]
enabled = true
```

### 日志查询

通过 `wrangler tail` 或 Cloudflare Dashboard 查看实时日志。

所有日志可通过 TraceID 关联：
```bash
wrangler tail | grep "<trace_id>"
```

## 回滚

```bash
# 回滚到上一个版本
wrangler rollback

# 部署特定版本
wrangler deploy --version <version-id>
```

## 常见问题

### D1 数据库连接失败

确保 `wrangler.toml` 中的 `database_id` 正确，且 Worker 已绑定 D1。

### Service Binding 404

确保被调用的 Worker 已部署且名称与 `wrangler.toml` 中一致。

### Workflows 超时

Cloudflare Workflows 的默认超时为 15 分钟。超长任务建议拆分为多个子工作流。

### 积分操作不生效

积分变更使用 D1 事务保证原子性。检查是否在同一个 DB 实例上操作，以及事务是否已提交。
