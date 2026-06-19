# Swarm 密钥管理规范
#
# 企业级安全要求：禁止在代码仓库中存储明文密钥。
# 所有密钥通过 Cloudflare Dashboard 的 Worker Secrets 注入。

## 密钥清单

| 环境变量 | 所属 Worker | 用途 | 获取方式 |
|----------|-------------|------|----------|
| `INTERNAL_SECRET` | 全部 | Service Binding 内部认证 | `openssl rand -hex 32` 生成 |
| `JWT_SECRET` | gateway | JWT 签名密钥 | `openssl rand -hex 32` 生成 |
| `WX_APP_ID` | gateway | 微信小程序 AppID | 微信公众平台 |
| `WX_APP_SECRET` | gateway | 微信小程序 Secret | 微信公众平台 |
| `EMAIL_API_KEY` | workflow | 邮件发送 | Resend.com |
| `WEATHER_API_KEY` | workflow | 天气查询 | 和风天气 |
| `SEARCH_API_KEY` | workflow | 搜索服务（可选） | SerpAPI 等 |

## 生产环境注入方式

### 方式一：Cloudflare Dashboard（推荐）
```bash
# 通过 Cloudflare Dashboard → Workers & Pages → 选择 Worker → Settings → Variables
# 添加 Secret 类型的变量
```

### 方式二：Wrangler CLI
```bash
echo "my-secret-value" | wrangler secret put INTERNAL_SECRET --name swarm-gateway
```

### 方式三：init_secrets.sh（自动化注入）
```bash
# 1. 创建 .env.production 文件（切勿提交到 Git）
# 2. 执行脚本
chmod +x backend/init_secrets.sh
./backend/init_secrets.sh
```

## 本地开发

本地开发使用 `.dev.vars` 文件（已加入 `.gitignore`）：

```bash
cp backend/workers/gateway/.dev.vars.example backend/workers/gateway/.dev.vars
# 编辑 .dev.vars 填入你的密钥
```

## ⚠️ 安全红线

- 🚫 禁止在代码中硬编码 `INTERNAL_SECRET` / `JWT_SECRET`
- 🚫 禁止将 `.dev.vars` 提交到 Git
- 🚫 禁止在日志中明文打印密钥（TraceLogger 已自动脱敏）
- 🚫 禁止使用弱密钥（`password123`、`secret` 等）
- ✅ 密钥长度至少 32 个十六进制字符（128 bit 熵）
- ✅ 定期轮换密钥（建议每 90 天）
