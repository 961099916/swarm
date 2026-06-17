// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/index.ts

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { handleLogin, handleLogout } from "./handlers/auth";
import { handleUserProfile, handleUpdateProfile, handleUploadAvatar } from "./handlers/user";
import { handleBindInvite, handleAdReward, handleCreditsHistory } from "./handlers/credits";
import { TraceLogger, startupSecurityCheck } from "@swarm/shared";
import { ResponseBuilder } from "./utils/response";

export interface Env {
  DB: D1Database;
  AVATAR_BUCKET: R2Bucket;
  CACHE_KV: KVNamespace;
  // Secrets
  INTERNAL_SECRET: string;
  JWT_SECRET: string;
  // Vars
  WX_APP_ID: string;
  WX_APP_SECRET: string; // 也从 Secret 中获取
  ALLOWED_ORIGIN?: string;
}

interface UserVariables {
  traceId: string;
  userId: string;
}

const app = new Hono<{ Bindings: Env; Variables: UserVariables }>();

// ══════════════════════════════════════════════════
// 中间件与安全拦截
// ══════════════════════════════════════════════════

app.use("*", async (c: Context, next: Next) => {
  const isAvatar = c.req.path.startsWith("/avatars/");
  const traceId = c.req.header("X-Trace-Id") || crypto.randomUUID();
  c.set("traceId", traceId);
  c.header("X-Trace-Id", traceId);

  if (isAvatar) {
    return next();
  }

  // 2. 启动 Fail-Fast 安全健康预检，确保必需密钥在部署时未遗漏
  const checkError = await startupSecurityCheck(c.env, traceId, ["INTERNAL_SECRET", "JWT_SECRET"]);
  if (checkError) return checkError;

  // 3. 内部通信签名校验，强力阻断恶意越权绕过网关
  const internalKey = c.req.header("X-Internal-Key");
  if (!internalKey || internalKey !== c.env.INTERNAL_SECRET) {
    TraceLogger.warn("USER", "UNAUTHORIZED_BYPASS", traceId, `安全拦截：非法客户端绕过网关直接请求核心服务`);
    return c.json({ success: false, error: "Unauthorized access", traceId }, 401);
  }

  // 微信登录接口无需鉴权绑定 userId
  const isLogin = c.req.path === "/api/v1/auth/login";
  if (!isLogin) {
    // 4. 解析绑定网关下发的用户身份
    const userId = c.req.header("X-User-Id");
    if (!userId) {
      TraceLogger.warn("USER", "MISSING_IDENTITY", traceId, `安全拦截：网关请求未携带 X-User-Id 身份元数据`);
      return c.json({ success: false, error: "Missing identity metadata", traceId }, 400);
    }
    c.set("userId", userId);
  }

  // 5. 抓取入参
  let query = c.req.query();
  let requestBody: any = null;
  const contentType = c.req.header("Content-Type") || "";
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && contentType.includes("application/json")) {
    try {
      const clonedReq = c.req.raw.clone();
      requestBody = await clonedReq.json();
    } catch (err) {
      // 容错
    }
  }

  TraceLogger.info("USER", "REQUEST_INBOUND", traceId, `User Worker 接收内部请求: ${c.req.method} ${c.req.path}`, c.get("userId"), {
    query,
    body: requestBody
  });

  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;

  // 6. 抓取出参
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
      } catch (err) {
        // 容错
      }
    }
  }

  TraceLogger.info("USER", "REQUEST_OUTBOUND", traceId, `User Worker 完成请求响应: ${c.req.method} ${c.req.path} -> [${status}] (${durationMs}ms)`, c.get("userId"), {
    status,
    durationMs,
    response: responseBody
  });
});

// ─── 头像托管路由（由 Core/User 独占写，独占读写 R2）───

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
  } catch (error: any) {
    TraceLogger.error("USER", "AVATAR_READ_FAILED", traceId, `头像读取故障: key=${key}`, error);
    return new Response(null, { status: 500 });
  }
});

// ─── 微信登录 ───
app.post("/api/v1/auth/login", async (c) => {
  return await handleLogin(c.req.raw, c.env.DB, c.env, c.get("traceId"));
});

// ─── 需要身份绑定的业务路由 ───
app.post("/api/v1/auth/logout", async (c) => {
  return await handleLogout(c.req.raw, c.env.DB, c.env.CACHE_KV, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/user/profile", async (c) => {
  return await handleUserProfile(c.env.DB, c.get("userId"), c.get("traceId"));
});

app.put("/api/v1/user/profile", async (c) => {
  return await handleUpdateProfile(c.req.raw, c.env.DB, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/user/avatar", async (c) => {
  return await handleUploadAvatar(c.req.raw, c.env.AVATAR_BUCKET, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/credits/bind-invite", async (c) => {
  return await handleBindInvite(c.req.raw, c.env.DB, c.get("userId"), c.get("traceId"));
});

app.post("/api/v1/credits/reward", async (c) => {
  return await handleAdReward(c.req.raw, c.env.DB, c.env, c.get("userId"), c.get("traceId"));
});

app.get("/api/v1/credits/history", async (c) => {
  return await handleCreditsHistory(c.req.raw, c.env.DB, c.get("userId"), c.get("traceId"));
});

// ─── 404 ───
app.notFound(async (c) => {
  return ResponseBuilder.error("资源不存在", c.get("traceId") || crypto.randomUUID(), 404);
});

// ─── 全局未知错误拦截 ───
app.onError(async (err, c) => {
  const traceId = c.get("traceId") || crypto.randomUUID();
  const userId = c.get("userId") || undefined;
  TraceLogger.error("USER", "UNCAUGHT_EXCEPTION", traceId, `服务未捕获异常: ${err.message || err}`, err, userId);
  return ResponseBuilder.internalError("系统繁忙，请联系系统管理员", traceId);
});

export default app;
