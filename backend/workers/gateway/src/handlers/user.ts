import { UserRow, users } from "@swarm/identity";
import { ApiResponse } from "@swarm/kernel";
import { TraceLogger } from "@swarm/kernel";
import { ApiRes, getErrorMessage } from "/kernel";
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
      return ApiRes.badRequest("未上传头像文件", traceId);
    }

    if (!file.type.startsWith("image/")) {
      return ApiRes.badRequest("仅支持图片格式", traceId);
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      return ApiRes.badRequest("头像文件不能超过 2MB", traceId);
    }

    const ext = file.type === "image/png" ? "png" : "jpg";
    const key = `${userId}/${crypto.randomUUID()}.${ext}`;

    const buffer = await file.arrayBuffer();
    await avatarBucket.put(key, buffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: userId },
    });

    TraceLogger.info("GATEWAY", "AVATAR_UPLOAD_SUCCESS", traceId, `头像上传成功`, userId, { key, fileType: file.type, fileSize: file.size });

    const publicUrl = `/avatars/${key}`;
    return ApiRes.success({ url: publicUrl }, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "AVATAR_UPLOAD_FAILED", traceId, `头像上传失败`, error, userId);
    return ApiRes.internalError("头像上传异常，请稍后重试", traceId);
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

  return ApiRes.success(profile, traceId);
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
        return ApiRes.badRequest("昵称不能为空", traceId);
      }
      if (trimmed.length > 30) {
        return ApiRes.badRequest("昵称不能超过30个字符", traceId);
      }
      updates.nickname = trimmed;
    }

    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl !== "" && !body.avatarUrl.startsWith("http") && !body.avatarUrl.startsWith("/avatars/")) {
        return ApiRes.badRequest("头像地址格式不正确", traceId);
      }
      updates.avatarUrl = body.avatarUrl;
    }

    const drizzleDb = drizzle(db);
    await drizzleDb.update(users).set(updates).where(eq(users.id, userId));
    TraceLogger.info("GATEWAY", "UPDATE_PROFILE_SUCCESS", traceId, `用户资料更新成功`, userId, { changedFields: Object.keys(updates) });
    return ApiRes.success({ success: true }, traceId);
  } catch (error: unknown) {
        TraceLogger.error("GATEWAY", "UPDATE_PROFILE_FAILED", traceId, `更新用户资料失败`, error, userId);
    return ApiRes.internalError("系统更新用户资料异常", traceId);
  }
}
