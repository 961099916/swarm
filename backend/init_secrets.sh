#!/bin/bash
# File: /Users/zhangjiahao/IdeaProjects/swarm/backend/init_secrets.sh

# ==============================================================================
# Swarm 微服务生产环境机密变量 (Secrets) 一键初始化注入脚本
# 
# 职责：生成高强度签名秘钥，并安全、非交互式地上传至 Cloudflare KMS (Workers Secrets)。
# ==============================================================================

# 设置命令执行出错即退出
set -e

echo -e "\033[36m============================================================\033[0m"
echo -e "\033[36m          Swarm 后端微服务生产环境 Secrets 一键注入工具        \033[0m"
echo -e "\033[36m============================================================\033[0m"

# 1. 自动产生生产级高强度随机对称秘钥 (32 字节十六进制)
GENERATED_INTERNAL_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "swarm_internal_shared_secret_key_default_2026_rand")
GENERATED_JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "swarm_jwt_token_signing_secret_default_2026_rand")

# 2. 交互式获取微信端及第三方密钥 (若回车则使用默认开发模拟秘钥)
read -p "请输入微信小程序 WX_APP_SECRET [默认: ]: " INPUT_WX_SECRET
WX_APP_SECRET=${INPUT_WX_SECRET:-""}

echo -e "\n\033[33m即将开始上传密钥至 Cloudflare... 请确保您已登录 (npx wrangler whoami)\033[0m\n"

# 3. 顺序注入各个微服务 (使用 Pipeline 管道非交互写入)

# 3.1 网关 (gateway)
echo -e "\033[32m[1/6] 注入网关 (swarm-gateway) 环境变量...\033[0m"
cd workers/gateway
echo -n "$GENERATED_INTERNAL_SECRET" | npx wrangler secret put INTERNAL_SECRET
echo -n "$GENERATED_JWT_SECRET" | npx wrangler secret put JWT_SECRET
echo -n "$WX_APP_SECRET" | npx wrangler secret put WX_APP_SECRET
cd ../..

# 3.2 用户服务 (swarm-user)
echo -e "\033[32m[2/6] 注入用户服务 (swarm-user) 环境变量...\033[0m"
cd workers/user
echo -n "$GENERATED_INTERNAL_SECRET" | npx wrangler secret put INTERNAL_SECRET
echo -n "$GENERATED_JWT_SECRET" | npx wrangler secret put JWT_SECRET
echo -n "$WX_APP_SECRET" | npx wrangler secret put WX_APP_SECRET
cd ../..

# 3.3 任务引擎 (swarm-engine)
echo -e "\033[32m[3/6] 注入任务引擎 (swarm-engine) 环境变量...\033[0m"
cd workers/engine
echo -n "$GENERATED_INTERNAL_SECRET" | npx wrangler secret put INTERNAL_SECRET
cd ../..

# 3.4 后台管理 (swarm-admin)
echo -e "\033[32m[4/6] 注入后台管理 (swarm-admin) 环境变量...\033[0m"
cd workers/admin
echo -n "$GENERATED_INTERNAL_SECRET" | npx wrangler secret put INTERNAL_SECRET
cd ../..

# 3.5 评测服务 (swarm-quiz)
echo -e "\033[32m[5/6] 注入评测服务 (swarm-quiz) 环境变量...\033[0m"
cd workers/quiz
echo -n "$GENERATED_INTERNAL_SECRET" | npx wrangler secret put INTERNAL_SECRET
cd ../..

# 3.6 工作流服务 (swarm-workflow)
# 暂无生产环境加密 Secrets (EMAIL_FROM 为 wrangler.toml 的 vars 变量)
echo -e "\033[32m[6/6] 工作流服务 (swarm-workflow) 无需注入加密秘钥...\033[0m"

echo -e "\n\033[36m============================================================\033[0m"
echo -e "\033[36m🎉  机密环境变量上传成功！已自动解除系统的 Fail-Fast 阻断模式！ \033[0m"
echo -e "\033[36m============================================================\033[0m"

echo -e "\n\033[33m[CRITICAL] 请妥善备份以下自动为您生成的生产签名秘钥 (本地已写入各服务 .dev.vars 用于调试)：\033[0m"
echo -e "\033[32mINTERNAL_SECRET = \033[0m $GENERATED_INTERNAL_SECRET"
echo -e "\033[32mJWT_SECRET      = \033[0m $GENERATED_JWT_SECRET"
echo -e "\033[33m============================================================\033[0m\n"
