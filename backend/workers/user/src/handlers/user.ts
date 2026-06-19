import { users } from "@swarm/identity";
import { TraceLogger } from "@swarm/kernel";

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/handlers/user.ts

import { getDrizzleDb } from "../utils/drizzleInstance";
import { ResponseBuilder } from "../utils/response";
import { eq } from "drizzle-orm";

/**
 * 头像上传接口 (POST /api/v1/user/avatar)
 * 接收 multipart/form-data 并上传至 R2
 */
export async function handleUploadAvatar(
  request: Request,
  avatarBucket: R2Bucket,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return ResponseBuilder.badRequest("未上传头像文件", traceId);
    }

    if (!file.type.startsWith("image/")) {
      return ResponseBuilder.badRequest("仅支持图片格式", traceId);
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      return ResponseBuilder.badRequest("头像文件不能超过 2MB", traceId);
    }

    const ext = file.type === "image/png" ? "png" : "jpg";
    const key = `${userId}/${crypto.randomUUID()}.${ext}`;

    const buffer = await file.arrayBuffer();
    await avatarBucket.put(key, buffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: userId },
    });

    TraceLogger.info("USER", "AVATAR_UPLOAD", traceId, `用户上传头像成功: key=${key}, size=${file.size}`, userId);

    const publicUrl = `/avatars/${key}`;
    return ResponseBuilder.success({ url: publicUrl }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("USER", "AVATAR_UPLOAD_FAILED", traceId, `头像上传异常: getErrorMessage(error)`, error, userId);
    return ResponseBuilder.internalError("头像上传异常，请稍后重试", traceId);
  }
}

/**
 * 获取个人资料接口 (GET /api/v1/user/profile)
 */
export async function handleUserProfile(
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const drizzleDb = getDrizzleDb(db);
    const userResult = await drizzleDb.select().from(users).where(eq(users.id, userId));
    
    if (!userResult || userResult.length === 0) {
      return ResponseBuilder.error("未找到该用户资料", traceId, 404);
    }

    const user = userResult[0];
    const profile = {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      role: user.role,
      credits: user.credits
    };

    return ResponseBuilder.success(profile, traceId);
  } catch (error: unknown) {
    TraceLogger.error("USER", "GET_PROFILE_FAILED", traceId, `获取个人资料异常: getErrorMessage(error)`, error, userId);
    return ResponseBuilder.internalError("查询个人资料异常，请稍后重试", traceId);
  }
}

/**
 * 更新个人资料接口 (PUT /api/v1/user/profile)
 */
export async function handleUpdateProfile(
  request: Request,
  db: D1Database,
  userId: string,
  traceId: string
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      nickname?: string;
      avatarUrl?: string;
    };

    const now = new Date().toISOString();
    const updates: Record<string, string> = { updatedAt: now };

    if (body.nickname !== undefined) {
      const trimmed = body.nickname.trim();
      if (trimmed.length < 1) {
        return ResponseBuilder.badRequest("昵称不能为空", traceId);
      }
      if (trimmed.length > 30) {
        return ResponseBuilder.badRequest("昵称不能超过30个字符", traceId);
      }
      updates.nickname = trimmed;
    }

    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl !== "" && !body.avatarUrl.startsWith("http") && !body.avatarUrl.startsWith("/avatars/")) {
        return ResponseBuilder.badRequest("头像地址格式不正确", traceId);
      }
      updates.avatarUrl = body.avatarUrl;
    }

    if (Object.keys(updates).length <= 1) {
      return ResponseBuilder.badRequest("缺少更新字段", traceId);
    }

    const drizzleDb = getDrizzleDb(db);
    await drizzleDb.update(users).set(updates).where(eq(users.id, userId));

    TraceLogger.info("USER", "UPDATE_PROFILE", traceId, `用户个人资料更新成功`, userId, body);
    return ResponseBuilder.success({ success: true }, traceId);
  } catch (error: unknown) {
    TraceLogger.error("USER", "UPDATE_PROFILE_FAILED", traceId, `更新个人资料异常: getErrorMessage(error)`, error, userId);
    return ResponseBuilder.internalError("系统更新资料异常，请稍后重试", traceId);
  }
}
