import { UserRow, users, ApiResponse } from "@swarm/shared";
import { ResponseBuilder } from "../utils/response";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

/**
 * 头像上传接口 (POST /api/v1/user/avatar)
 * 接收微信小程序 wx.uploadFile 传来的 multipart/form-data
 * 上传到 R2 bucket，返回永久访问 URL
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

    console.info(`[INFO] [TraceID: ${traceId}] 头像上传成功: ${key} (${file.type}, ${file.size} bytes)`);

    const publicUrl = `/avatars/${key}`;
    return ResponseBuilder.success({ url: publicUrl }, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 头像上传失败: ${error.message || error}`);
    return ResponseBuilder.internalError("头像上传异常，请稍后重试", traceId);
  }
}

/**
 * 获取用户个人资料接口
 */
export async function handleUserProfile(
  user: UserRow,
  traceId: string
): Promise<Response> {
  const profile = {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    role: user.role,
    credits: user.credits
  };

  return ResponseBuilder.success(profile, traceId);
}

/**
 * 更新用户个人资料接口 (PUT /user/profile)
 * 允许修改：nickname（昵称）, avatarUrl（头像）
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

    const drizzleDb = drizzle(db);
    await drizzleDb.update(users).set(updates).where(eq(users.id, userId));
    console.info(`[INFO] [TraceID: ${traceId}] 用户资料更新成功: ${userId} changes=${JSON.stringify(Object.keys(updates))}`);
    return ResponseBuilder.success({ success: true }, traceId);
  } catch (error: any) {
    console.error(`[ERROR] [TraceID: ${traceId}] 更新用户资料失败: ${error.message || error}`);
    return ResponseBuilder.internalError("系统更新用户资料异常", traceId);
  }
}
