// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/services/user.service.ts

import { UserRow } from "@swarm/identity";
import { TOKEN_EXPIRY_SECONDS } from "@swarm/identity";
import { CreditsConfig } from "@swarm/credits";
import { CacheService, TraceLogger } from "@swarm/kernel";
import { signJWT } from "../utils/jwtHelper";
import { UserRepository } from "../repositories/user.repository";
import { UserConstants } from "../constants/user.constant";
import { sql } from "drizzle-orm";

interface WxSessionResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

export class UserService {
  constructor(private userRepo: UserRepository) {}

  public async fetchWxOpenId(code: string, appId: string, appSecret: string): Promise<string> {
    const wxUrl = `${UserConstants.WX_API_URL_PREFIX}?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    if (!wxRes.ok) {
      throw new Error(`微信接口请求失败，状态码: ${wxRes.status}`);
    }
    const wxData = (await wxRes.json()) as WxSessionResponse;
    if (wxData.errcode || !wxData.openid) {
      throw new Error(`微信登录错误: ${wxData.errmsg || "未知原因"} (错误码: ${wxData.errcode})`);
    }
    return wxData.openid;
  }

  public async registerUser(params: {
    openId: string;
    nickname?: string;
    avatarUrl?: string;
    inviterId?: string;
    traceId: string;
  }): Promise<UserRow> {
    const { openId, nickname, avatarUrl, inviterId, traceId } = params;
    const newUserId = crypto.randomUUID();
    const now = new Date().toISOString();

    let invitedBy: string | null = null;
    if (inviterId && inviterId !== newUserId) {
      const inviter = await this.userRepo.findUserById(inviterId);
      if (inviter) invitedBy = inviter.id;
    }

    const db = this.userRepo.db;
    const initialCredits = await CreditsConfig.getInitialCredits(db);
    const inviteReward = await CreditsConfig.getInviteReward(db);
    const finalCredits = invitedBy ? initialCredits + inviteReward : initialCredits;

    const dbUser = await this.userRepo.registerNewUserTransaction({
      newUserId,
      openId,
      nickname,
      avatarUrl,
      invitedBy,
      finalCredits,
      initialCredits,
      inviteReward,
      now,
    });

    TraceLogger.info("USER", "USER_REGISTER", traceId, `新用户注册成功: userId=${dbUser.id}`, dbUser.id);
    return this.mapUserToRow(dbUser);
  }

  public async generateUserToken(user: UserRow, jwtSecret: string): Promise<string> {
    const expInSeconds = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS;
    return await signJWT(
      {
        userId: user.id,
        tokenVersion: user.token_version,
        exp: expInSeconds,
      },
      jwtSecret
    );
  }

  public async loginFlow(params: {
    code: string;
    nickname?: string;
    avatarUrl?: string;
    inviterId?: string;
    wxAppId: string;
    wxAppSecret: string;
    jwtSecret: string;
    kv: KVNamespace;
    traceId: string;
  }): Promise<{ token: string; user: UserRow }> {
    const { code, nickname, avatarUrl, inviterId, wxAppId, wxAppSecret, jwtSecret, kv, traceId } = params;
    const openId = await this.fetchWxOpenId(code, wxAppId, wxAppSecret);

    let userObj = await this.userRepo.findUserByOpenId(openId);
    let userRow: UserRow;

    if (!userObj) {
      userRow = await this.registerUser({ openId, nickname, avatarUrl, inviterId, traceId });
    } else {
      userRow = this.mapUserToRow(userObj);
      if (userRow.is_banned === UserConstants.STATUS_BANNED) {
        TraceLogger.warn("USER", "LOGIN_BLOCKED", traceId, `封禁用户尝试登录被拦截: userId=${userRow.id}`, userRow.id);
        throw new Error(`BANNED:${userRow.banned_reason || "违反服务协议"}`);
      }
    }

    const token = await this.generateUserToken(userRow, jwtSecret);
    const cacheKey = `${UserConstants.AUTH_CACHE_PREFIX}${userRow.id}`;

    await CacheService.set(
      kv,
      cacheKey,
      { tokenVersion: userRow.token_version, isBanned: userRow.is_banned, role: userRow.role },
      UserConstants.AUTH_CACHE_TTL_SEC
    );

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/services/user.service.ts
    TraceLogger.info("USER", "USER_LOGIN", traceId, `用户登录成功: userId=${userRow.id}`, userRow.id);
    return { token, user: userRow };
  }

  public async adminLoginFlow(params: {
    username?: string;
    password?: string;
    superKey?: string;
    envAdminUsername?: string;
    envAdminPassword?: string;
    envAdminSuperKey?: string;
    jwtSecret: string;
    kv: KVNamespace;
    traceId: string;
  }): Promise<{ token: string; user: any }> {
    const {
      username,
      password,
      superKey,
      envAdminUsername,
      envAdminPassword,
      envAdminSuperKey,
      jwtSecret,
      kv,
      traceId
    } = params;

    const expectedUser = envAdminUsername || "admin";
    const expectedPass = envAdminPassword || "admin123";
    const expectedKey = envAdminSuperKey || ""; 

    if (username !== expectedUser || password !== expectedPass) {
      throw new Error("用户名或密码错误");
    }

    // 去除唯一用户超级管理员的双重安全密钥校验，直接允许通过用户名密码登录
    /*
    if (expectedKey && superKey !== expectedKey) {
      throw new Error("安全密钥校验失败");
    }
    */

// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/services/user.service.ts
    const adminOpenId = `SYSTEM_ADMIN_${expectedUser.toUpperCase()}`;
    let userObj = await this.userRepo.findUserByOpenId(adminOpenId);
    let userRow: UserRow;

    if (!userObj) {
      const now = new Date().toISOString();
      const newUserId = crypto.randomUUID();
      
      await this.userRepo.createAdminUserDirectly({
        id: newUserId,
        openId: adminOpenId,
        nickname: "集群超级管理员",
        now,
      });

      userRow = this.mapUserToRow(await this.userRepo.findUserById(newUserId));
      TraceLogger.info("USER", "ADMIN_AUTO_CREATE", traceId, `系统首次登录，自动创建内置管理员数据行: userId=${userRow.id}`, userRow.id);
    } else {
      userRow = this.mapUserToRow(userObj);
      if (userRow.role !== "ADMIN") {
        await this.userRepo.updateUser(userRow.id, {
          role: "ADMIN",
          updatedAt: new Date().toISOString()
        });
        userRow.role = "ADMIN";
      }
    }

    const token = await this.generateUserToken(userRow, jwtSecret);
    const cacheKey = `${UserConstants.AUTH_CACHE_PREFIX}${userRow.id}`;

    await CacheService.set(
      kv,
      cacheKey,
      { tokenVersion: userRow.token_version, isBanned: userRow.is_banned, role: userRow.role },
      UserConstants.AUTH_CACHE_TTL_SEC
    );

    TraceLogger.info("USER", "ADMIN_LOGIN_SUCCESS", traceId, `管理员登录成功: userId=${userRow.id}`, userRow.id);
    
    return {
      token,
      user: {
        id: userRow.id,
        nickname: userRow.nickname || "系统管理员",
        role: userRow.role,
        avatarUrl: userRow.avatar_url
      }
    };
  }

  public async logoutFlow(params: {
    userId: string;
    kv: KVNamespace;
    traceId: string;
  }): Promise<void> {
    const { userId, kv, traceId } = params;
    const now = new Date().toISOString();

    await this.userRepo.updateUser(userId, {
      tokenVersion: sql`token_version + 1`,
      updatedAt: now,
    });

    const cacheKey = `${UserConstants.AUTH_CACHE_PREFIX}${userId}`;
    await CacheService.delete(kv, cacheKey);
    TraceLogger.info("USER", "USER_LOGOUT", traceId, `用户退出登录成功，Token 已强制失效`, userId);
  }

  public async getUserProfile(userId: string): Promise<any> {
    const userObj = await this.userRepo.findUserById(userId);
    if (!userObj) {
      throw new Error("USER_NOT_FOUND");
    }
    return {
      id: userObj.id,
      nickname: userObj.nickname,
      avatarUrl: userObj.avatarUrl,
      role: userObj.role,
      credits: userObj.credits,
    };
  }

  public async updateProfile(userId: string, body: { nickname?: string; avatarUrl?: string }): Promise<void> {
    const updates: Record<string, string> = { updatedAt: new Date().toISOString() };

    if (body.nickname !== undefined) {
      const trimmed = body.nickname.trim();
      if (trimmed.length < UserConstants.NICKNAME_MIN_LENGTH || trimmed.length > UserConstants.NICKNAME_MAX_LENGTH) {
        throw new Error("INVALID_NICKNAME");
      }
      updates.nickname = trimmed;
    }

    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl !== "" && !body.avatarUrl.startsWith("http") && !body.avatarUrl.startsWith(UserConstants.AVATAR_PATH_PREFIX)) {
        throw new Error("INVALID_AVATAR_URL");
      }
      updates.avatarUrl = body.avatarUrl;
    }

    if (Object.keys(updates).length <= 1) {
      throw new Error("NO_FIELDS_TO_UPDATE");
    }

    await this.userRepo.updateUser(userId, updates);
  }

  public async uploadAvatarToR2(params: {
    file: File;
    avatarBucket: R2Bucket;
    userId: string;
    traceId: string;
  }): Promise<string> {
    const { file, avatarBucket, userId, traceId } = params;
    if (!file.type.startsWith("image/")) {
      throw new Error("ONLY_IMAGES_SUPPORTED");
    }
    if (file.size > UserConstants.AVATAR_MAX_SIZE) {
      throw new Error("FILE_TOO_LARGE");
    }

    const ext = file.type === UserConstants.AVATAR_CONTENT_PNG ? UserConstants.AVATAR_EXT_PNG : UserConstants.AVATAR_EXT_JPG;
    const key = `${userId}/${crypto.randomUUID()}.${ext}`;
    const buffer = await file.arrayBuffer();

    await avatarBucket.put(key, buffer, {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: userId },
    });

    TraceLogger.info("USER", "AVATAR_UPLOAD", traceId, `用户上传头像成功: key=${key}, size=${file.size}`, userId);
    return `${UserConstants.AVATAR_PATH_PREFIX}${key}`;
  }

  private mapUserToRow(row: any): UserRow {
    return {
      id: row.id,
      wx_open_id: row.wxOpenId,
      nickname: row.nickname,
      avatar_url: row.avatarUrl,
      role: row.role as UserRow["role"],
      credits: row.credits,
      token_version: row.tokenVersion,
      is_banned: row.isBanned,
      banned_reason: row.bannedReason,
      invited_by: row.invitedBy,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }
}
