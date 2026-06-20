/**
 * RouteRegistry — 声明式网关路由注册表
 *
 * 替换硬编码的路由列表，实现「声明路由 → 自动注册」模式。
 * 新增内部服务时只需添加一条 RouteEntry，无需修改 Gateway 业务代码。
 *
 * DDD 模式：网关只做路由编排，不包含任何业务逻辑。
 */

export interface RouteEntry {
  /** 路由前缀，如 /api/v1/kb */
  prefix: string;
  /** 目标 Service Binding 字段名（Env 上的属性名） */
  target: string;
  /** 服务描述（仅日志用途） */
  label: string;
  /** 是否需要 ADMIN 角色（可组合 requireRoles） */
  requireAdmin?: boolean;
  /** 需要的角色列表 */
  requireRoles?: string[];
  /** 免鉴权路径（精确匹配，如 /api/v1/auth/login） */
  publicPaths?: string[];
}

/**
 * 网关路由表 — 所有内部服务的声明在此集中管理
 *
 * 原则：
 * 1. 新增服务 → 在下方添加一条 RouteEntry
 * 2. 每个路由 prefix 对应一个独立的 Service Binding
 * 3. requireAdmin 的路径由网关层前置拦截，无需下放鉴权
 */
export const ROUTE_TABLE: RouteEntry[] = [
  // ─── 身份与用户 (Identity & Access) ───
  {
    prefix: "/avatars",
    target: "CORE_SVC",
    label: "CORE_SVC (User Center - Avatars)",
    publicPaths: [],
  },
  {
    prefix: "/api/v1/auth",
    target: "CORE_SVC",
    label: "CORE_SVC (User Center - Auth)",
    publicPaths: ["/api/v1/auth/login", "/api/v1/auth/admin/login"],
  },
  {
    prefix: "/api/v1/user",
    target: "CORE_SVC",
    label: "CORE_SVC (User Center - Profile)",
  },

  // ─── 积分 & 邀请 (Credits) ───
  {
    prefix: "/api/v1/credits",
    target: "CORE_SVC",
    label: "CORE_SVC (User Center - Credits)",
  },

  // ─── 智能体与任务 (Agent Engine) ───
  {
    prefix: "/api/v1/agents",
    target: "ENGINE_SVC",
    label: "ENGINE_SVC (Agent Engine)",
  },
  {
    prefix: "/api/v1/tasks",
    target: "ENGINE_SVC",
    label: "ENGINE_SVC (Tasks)",
  },

  // ─── 管理后台 (Admin) ───
  {
    prefix: "/api/v1/admin",
    target: "ADMIN_SVC",
    label: "ADMIN_SVC (Admin Center)",
    requireAdmin: true,
  },

  // ─── 测评系统 (Quiz) ───
  {
    prefix: "/api/v1/quiz",
    target: "QUIZ_SVC",
    label: "QUIZ_SVC (Quiz System)",
  },

  // ─── 知识库 & RAG (Knowledge) ───
  {
    prefix: "/api/v1/kb",
    target: "RAG_SVC",
    label: "RAG_SVC (Knowledge Base)",
  },
  {
    prefix: "/api/v1/rag",
    target: "RAG_SVC",
    label: "RAG_SVC (RAG Internal)",
  },
];

/**
 * 从路径匹配路由条目
 */
export function matchRoute(path: string): RouteEntry | undefined {
  return ROUTE_TABLE.find(entry => path.startsWith(entry.prefix));
}
