#!/usr/bin/env bash

# File: backend/scripts/deploy-all.sh
set -eo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO] [$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[WARN] [$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_error() {
    echo -e "${RED}[ERROR] [$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
log_info "Swarm 后端一键部署工作目录设为: ${BACKEND_DIR}"

# 1. 前置检查
log_info "开始校验 Cloudflare 登录状态..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    log_error "未检测到有效的 Cloudflare 登录状态。请先在终端中执行 'npx wrangler login' 进行授权登录！"
    exit 1
fi
log_info "Cloudflare 账号校验通过。"

log_info "执行本地类型校验 (tsc type-check)..."
if ! (cd "${BACKEND_DIR}" && npm run type-check); then
    log_error "本地代码类型校验失败，已触发安全熔断！请修复编译报错后再进行部署。"
    exit 1
fi
log_info "本地类型校验通过，代码状态健康。"

# 2. 部署微服务
log_info "========================================="
log_info "[1/5] 开始部署工作流引擎 (swarm-workflow)..."
log_info "========================================="
(cd "${BACKEND_DIR}/workers/workflow" && npm run deploy)
log_info "工作流引擎 (swarm-workflow) 部署成功！"

log_info "========================================="
log_info "[2/5] 开始部署管理端 (swarm-admin)..."
log_info "========================================="
(cd "${BACKEND_DIR}/workers/admin" && npm run deploy)
log_info "管理端 (swarm-admin) 部署成功！"

log_info "========================================="
log_info "[3/5] 开始部署测评服务 (swarm-quiz)..."
log_info "========================================="
(cd "${BACKEND_DIR}/workers/quiz" && npm run deploy)
log_info "测评服务 (swarm-quiz) 部署成功！"

log_info "========================================="
log_info "[4/5] 开始部署网关服务 (swarm-gateway)..."
log_info "========================================="
(cd "${BACKEND_DIR}/workers/gateway" && npm run deploy)
log_info "网关服务 (swarm-gateway) 部署成功！"

log_info "========================================="
log_info "[5/5] 开始迁移 D1 数据库 Schema..."
log_info "========================================="
cd "${BACKEND_DIR}" && npx wrangler d1 execute swarm-db --remote --file=./schema.sql
log_info "D1 数据库 Schema 迁移完成！"

log_info "========================================="
log_info "恭喜！Swarm 后端所有微服务已全部一键部署成功！"
log_info "========================================="
