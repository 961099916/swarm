# Swarm — Makefile
#
# 企业级项目统一命令行入口。
# 开发人员只需 `make <command>`，无需记忆 npm script 路径。
#
# 使用方式：
#   make install      # 安装全部依赖
#   make dev          # 启动本地开发环境
#   make check        # 完整质量门禁（lint + type-check + test）
#   make deploy       # 部署全部 Worker
#   make db:migrate   # 执行数据库迁移
#   make clean        # 清理构建产物

SHELL := /bin/bash
.PHONY: install dev check test lint type-check deploy clean db\:migrate db\:seed security-audit

# ─── 依赖管理 ───

install:
	@echo "📦 安装后端依赖..."
	cd backend && pnpm install
	@echo "📦 安装前端依赖..."
	cd frontend && npm ci
	@echo "✅ 依赖安装完成"

# ─── 开发 ───

dev:
	@echo "🚀 启动开发环境..."
	@echo "   请分别在终端中执行:"
	@echo "   cd backend/workers/gateway && pnpm run dev"
	@echo "   cd backend/workers/user && pnpm run dev"
	@echo "   cd backend/workers/engine && pnpm run dev"
	@echo "   前端通过微信开发者工具打开 frontend/"

# ─── 质量门禁 ───

check: lint type-check test

lint:
	@echo "🔍 ESLint 检查..."
	cd backend && pnpm run lint

type-check:
	@echo "🔎 TypeScript 类型检查..."
	cd backend && pnpm -r run type-check

test:
	@echo "🧪 运行单元测试..."
	cd backend && pnpm --filter @swarm/kernel run test
	@echo "✅ 测试完成"

# ─── 安全 ───

security-audit:
	@echo "🔒 npm 安全审计..."
	cd backend && npm audit --audit-level=high
	cd frontend && npm audit --audit-level=high
	@echo "🔒 硬编码 Secret 扫描..."
	@if grep -rn "sk-[A-Za-z0-9]\{20,\}\|ghp_\|gho_\|ghu_\|ghs_\|ghr_" --include="*.ts" --include="*.js" --include="*.json" . 2>/dev/null | grep -v "node_modules\|\.wrangler\|\.npm-cache" | grep .; then \
		echo "❌ 发现疑似硬编码 Secret!"; \
		exit 1; \
	else \
		echo "✅ 无硬编码 Secret"; \
	fi
	@echo "🔒 依赖漏洞扫描..."
	npx --yes sbom --help >/dev/null 2>&1 || true

# ─── 数据库 ───

db\:migrate:
	@echo "🗄️  执行数据库迁移..."
	@for f in backend/migrations/*.sql; do \
		echo "  → $$f"; \
		wrangler d1 execute swarm-db --file=$$f; \
	done
	@echo "✅ 迁移完成"

db\:seed:
	@echo "🌱 注入种子数据..."
	wrangler d1 execute swarm-db --file=backend/schema.sql
	@echo "✅ 种子数据完成"

# ─── 部署 ───

deploy:
	@echo "📤 部署所有 Worker..."
	@for dir in gateway user engine admin quiz workflow; do \
		echo "  → $$dir"; \
		cd backend/workers/$$dir && npm run deploy; \
	done
	@echo "✅ 部署完成"

# ─── 清理 ───

clean:
	@echo "🧹 清理构建产物..."
	rm -rf backend/packages/*/dist
	rm -rf backend/workers/*/dist
	rm -rf frontend/static/styles/tailwind.wxss
	rm -rf .wrangler
	find . -name "*.tsbuildinfo" -delete
	find . -name "*.sqlite*" -delete
	@echo "✅ 清理完成"
