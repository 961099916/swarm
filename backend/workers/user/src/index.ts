// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { TraceLogger, startupSecurityCheck, getErrorMessage, handleGlobalError } from "@swarm/kernel";
import { ResponseBuilder } from "./utils/response";
import { UserRepository } from "./repositories/user.repository";
import { UserService } from "./services/user.service";
import { CreditsService } from "./services/credits.service";
import { UserController } from "./controllers/user.controller";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/index.ts
export interface Env {
  DB: D1Database;
  AVATAR_BUCKET: R2Bucket;
  CACHE_KV: KVNamespace;
  // Secrets
  INTERNAL_SECRET: string;
  JWT_SECRET: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SUPER_KEY?: string;
  // Vars
  WX_APP_ID: string;
  WX_APP_SECRET: string;
  ALLOWED_ORIGIN?: string;
}

interface UserVariables {
  traceId: string;
  userId: string;
}

const app = new Hono<{ Bindings: Env; Variables: UserVariables }>();

// ══════════════════════════════════════════════════
// 中间件与请求生命周期拦截
// ══════════════════════════════════════════════════

async function handleInboundLog(c: Context, traceId: string) {
  let query = c.req.query();
  let requestBody: any = null;
  const contentType = c.req.header("Content-Type") || "";
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && contentType.includes("application/json")) {
    try {
      const clonedReq = c.req.raw.clone();
      requestBody = await clonedReq.json();
    } catch {}
  }
  TraceLogger.info("USER", "REQUEST_INBOUND", traceId, `User Worker 接收内部请求: ${c.req.method} ${c.req.path}`, c.get("userId"), {
    query,
    body: requestBody
  });
}

async function handleOutboundLog(c: Context, traceId: string, durationMs: number) {
  let responseBody: any = null;
  let status = 200;
  if (c.res) {
    status = c.res.status;
    const resContentType = c.res.headers.get("Content-Type") || "";
    if (resContentType.includes("application/json")) {
      try {
        const clonedRes = c.res.clone();
        const text = await clonedRes.text();
        if (text.length < 2000) {
          responseBody = JSON.parse(text);
        } else {
          responseBody = { truncated: text.slice(0, 1000) + "... (truncated)" };
        }
      } catch {}
    }
  }
  TraceLogger.info("USER", "REQUEST_OUTBOUND", traceId, `User Worker 完成请求响应: ${c.req.method} ${c.req.path} -> [${status}] (${durationMs}ms)`, c.get("userId"), {
    status,
    durationMs,
    response: responseBody
  });
}

app.use("*", async (c: Context, next: Next) => {
  const isAvatar = c.req.path.startsWith("/avatars/");
  const traceId = c.req.header("X-Trace-Id") || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("X-Trace-Id", traceId);

  if (isAvatar) {
    return next();
  }

  const checkError = await startupSecurityCheck(c.env, traceId, ["INTERNAL_SECRET", "JWT_SECRET"]);
  if (checkError) return checkError;

  const internalKey = c.req.header("X-Internal-Key");
  if (!internalKey || internalKey !== c.env.INTERNAL_SECRET) {
    TraceLogger.warn("USER", "UNAUTHORIZED_BYPASS", traceId, `安全拦截：非法客户端绕过网关直接请求核心服务`);
    return c.json({ success: false, error: "Unauthorized access", traceId }, 401);
  }

  const isLogin = c.req.path === "/api/v1/auth/login" || c.req.path === "/api/v1/auth/admin/login";
  if (!isLogin) {
    const userId = c.req.header("X-User-Id");
    if (!userId) {
      TraceLogger.warn("USER", "MISSING_IDENTITY", traceId, `安全拦截：网关请求未携带 X-User-Id 身份元数据`);
      return c.json({ success: false, error: "Missing identity metadata", traceId }, 400);
    }
    c.set("userId", userId);
  }

  await handleInboundLog(c, traceId);
  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;
  await handleOutboundLog(c, traceId, durationMs);
});

// ══════════════════════════════════════════════════
// 头像托管路由 (R2 读取)
// ══════════════════════════════════════════════════

app.get("/avatars/*", async (c) => {
  const traceId = c.req.header("X-Trace-Id") || crypto.randomUUID();
  const key = c.req.path.replace("/avatars/", "");
  if (!key || key.length < 3) {
    return new Response(null, { status: 404 });
  }

  try {
    const object = await c.env.AVATAR_BUCKET.get(key);
    if (!object) {
      TraceLogger.warn("USER", "AVATAR_NOT_FOUND", traceId, `头像资源不存在: key=${key}`);
      return new Response(null, { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag);
    return new Response(object.body, { headers });
  } catch (error: unknown) {
    TraceLogger.error("USER", "AVATAR_READ_FAILED", traceId, `头像读取故障: key=${key}`, error);
    return new Response(null, { status: 500 });
  }
});

// ══════════════════════════════════════════════════
// 控制器工厂辅助方法
// ══════════════════════════════════════════════════

function getController(c: Context): UserController {
  const repo = new UserRepository(c.env.DB);
  const userSvc = new UserService(repo);
  const creditsSvc = new CreditsService(repo);
  return new UserController(userSvc, creditsSvc);
}

// ══════════════════════════════════════════════════
// 业务路由映射
// ══════════════════════════════════════════════════

app.post("/api/v1/auth/login", async (c) => {
  return await getController(c).login(c.req.raw, c.env, c.get("traceId"));
});

app.post("/api/v1/auth/admin/login", async (c) => {
  return await getController(c).adminLogin(c.req.raw, c.env, c.get("traceId"));
});

app.post("/api/v1/auth/logout", async (c) => {
  return await getController(c).logout(c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/user/profile", async (c) => {
  return await getController(c).getProfile(c.get("userId"), c.get("traceId"));
});

app.put("/api/v1/user/profile", async (c) => {
  return await getController(c).updateProfile(c.req.raw, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/user/avatar", async (c) => {
  return await getController(c).uploadAvatar(c.req.raw, c.env.AVATAR_BUCKET, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/credits/bind-invite", async (c) => {
  return await getController(c).bindInvite(c.req.raw, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/credits/reward", async (c) => {
  return await getController(c).claimAdReward(c.req.raw, c.env, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/credits/history", async (c) => {
  return await getController(c).getCreditsHistory(c.req.raw, c.get("userId"), c.get("traceId"));
});

app.get("/health", async (c) => {
  return c.json({ status: "ok", service: "user", timestamp: new Date().toISOString() });
});

app.notFound(async (c) => {
  return ResponseBuilder.error("资源不存在", c.get("traceId") || crypto.randomUUID(), 404);
});

app.onError(async (err, c) => {
  return handleGlobalError(err, c, "USER");
});

export default app;
