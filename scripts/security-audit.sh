#!/usr/bin/env bash
#
# Swarm 安全审计脚本
# 企业级安全检查：依赖漏洞、硬编码 Secret、配置泄露
#
# 使用方式：
#   ./scripts/security-audit.sh          # 运行完整审计
#   ./scripts/security-audit.sh --quick  # 仅检查硬编码 Secret
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
PASS=0
FAIL=0

check() {
  local desc="$1"
  local cmd="$2"
  echo -n "  [ ] $desc ... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 通过${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ 失败${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         Swarm 安全审计                                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/.."

echo "📋 1/6 依赖安全审计"
check "npm audit (backend)" "cd backend && npm audit --audit-level=high 2>&1 | grep -q 'found 0 vulnerabilities'"
check "npm audit (frontend)" "cd frontend && npm audit --audit-level=high 2>&1 | grep -q 'found 0 vulnerabilities'"

echo ""
echo "📋 2/6 硬编码 Secret 扫描"
check "无 API Key 泄露" "! grep -rn 'sk-[A-Za-z0-9]\\{20,\\}' --include='*.ts' --include='*.js' --include='*.json' . 2>/dev/null | grep -v 'node_modules\\|\\.wrangler\\|\\.npm-cache\\|package-lock' | grep ."
check "无 GitHub Token 泄露" "! grep -rn 'ghp_\\|gho_\\|ghu_\\|ghs_\\|ghr_' --include='*.ts' --include='*.js' --include='*.json' . 2>/dev/null | grep -v 'node_modules\\|\\.wrangler\\|\\.npm-cache\\|package-lock' | grep ."

echo ""
echo "📋 3/6 配置文件检查"
check ".env 未提交到 Git" "! git ls-files --error-unmatch .env 2>/dev/null"
check ".dev.vars 未提交到 Git" "! git ls-files --error-unmatch backend/workers/gateway/.dev.vars 2>/dev/null"

echo ""
echo "📋 4/6 代码质量检查"
check "无 catch(error: any) 残留" "! grep -rn 'catch.*:.*any' backend/workers/ --include='*.ts' 2>/dev/null | grep -v 'node_modules\\|\\.wrangler' | grep ."
check "无 console.log 残留" "! grep -rn 'console\\.log\\|console\\.info' backend/workers/ --include='*.ts' 2>/dev/null | grep -v 'node_modules\\|\\.wrangler\\|logger\\.ts' | grep ."

echo ""
echo "📋 5/6 CORS 安全"
check "CORS 默认非通配符" "grep -q 'swarm-gateway.jiuxia.online' backend/workers/gateway/src/index.ts"

echo ""
echo "📋 6/6 数据一致性"
check "credits 使用事务而非 batch" "grep -q 'transaction' backend/workers/gateway/src/creditsHelper.ts"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo -e "║  结果: ${GREEN}${PASS} 通过${NC}, ${RED}${FAIL} 失败${NC}                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
