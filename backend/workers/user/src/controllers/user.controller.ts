import { ApiRes, TraceLogger, getErrorMessage } from "@swarm/kernel";
import { UserService } from "../services/user.service";
import { CreditsService } from "../services/credits.service";
import { LoginReq } from "@swarm/identity";
import { CreditsConfig, BindInviteReq, AdRewardReq } from "@swarm/credits";

interface ExtendedLoginReq extends LoginReq {
  nickname?: string;
  avatarUrl?: string;
  inviterId?: string;
}

export class UserController {
  constructor(
    private userService: UserService,
    private creditsService: CreditsService
  ) {}

  public async login(
    request: Request,
    env: { JWT_SECRET: string; WX_APP_ID: string; WX_APP_SECRET: string; CACHE_KV: KVNamespace },
    traceId: string
  ): Promise<Response> {
    try {
      const body = (await request.json()) as ExtendedLoginReq;
      if (!body || !body.code) {
        return ApiRes.badRequest("缺少必要参数: code", traceId);
      }

      const { token, user } = await this.userService.loginFlow({
        code: body.code,
        nickname: body.nickname,
        avatarUrl: body.avatarUrl,
        inviterId: body.inviterId,
        wxAppId: env.WX_APP_ID,
        wxAppSecret: env.WX_APP_SECRET,
        jwtSecret: env.JWT_SECRET,
        kv: env.CACHE_KV,
        traceId,
      });

      return ApiRes.success({ token, user }, traceId);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.startsWith("BANNED:")) {
        const reason = errorMsg.substring(7);
        return ApiRes.forbidden(`您的账号已被封禁。原因：${reason}`, traceId);
      }
// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/controllers/user.controller.ts
      TraceLogger.error("USER", "LOGIN_CONTROLLER_FAILED", traceId, `登录控制层失败: ${errorMsg}`, error);
      return ApiRes.internalError("系统登录异常，请稍后再试", traceId);
    }
  }

  public async adminLogin(
    request: Request,
    env: { JWT_SECRET: string; ADMIN_USERNAME?: string; ADMIN_PASSWORD?: string; ADMIN_SUPER_KEY?: string; CACHE_KV: KVNamespace },
    traceId: string
  ): Promise<Response> {
    try {
      const body = (await request.json()) as { username?: string; password?: string; superKey?: string };
      const adminUser = await this.userService.adminLoginFlow({
        username: body.username,
        password: body.password,
        superKey: body.superKey,
        envAdminUsername: env.ADMIN_USERNAME,
        envAdminPassword: env.ADMIN_PASSWORD,
        envAdminSuperKey: env.ADMIN_SUPER_KEY,
        jwtSecret: env.JWT_SECRET,
        kv: env.CACHE_KV,
        traceId
      });
      return ApiRes.success(adminUser, traceId);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      TraceLogger.error("USER", "ADMIN_LOGIN_FAILED", traceId, `管理员登录控制层失败: ${errorMsg}`, error);
      return ApiRes.unauthorized(`登录失败: ${errorMsg}`, traceId);
    }
  }

  public async logout(
    kv: KVNamespace,
    userId: string,
    traceId: string
  ): Promise<Response> {
    try {
      await this.userService.logoutFlow({ userId, kv, traceId });
      return ApiRes.success({ success: true }, traceId);
    } catch (error: unknown) {
      TraceLogger.error("USER", "LOGOUT_CONTROLLER_FAILED", traceId, `登出控制层失败: ${getErrorMessage(error)}`, error, userId);
      return ApiRes.internalError("系统退出登录异常", traceId);
    }
  }

  public async getProfile(userId: string, traceId: string): Promise<Response> {
    try {
      const profile = await this.userService.getUserProfile(userId);
      return ApiRes.success(profile, traceId);
    } catch (error: unknown) {
      TraceLogger.error("USER", "GET_PROFILE_CONTROLLER_FAILED", traceId, `查询个人资料控制层异常: ${getErrorMessage(error)}`, error, userId);
      if (getErrorMessage(error) === "USER_NOT_FOUND") {
        return ApiRes.error(1030, "未找到该用户资料", traceId);
      }
      return ApiRes.internalError("查询个人资料异常，请稍后重试", traceId);
    }
  }

  public async updateProfile(request: Request, userId: string, traceId: string): Promise<Response> {
    try {
      const body = (await request.json()) as { nickname?: string; avatarUrl?: string };
      await this.userService.updateProfile(userId, body);
      return ApiRes.success({ success: true }, traceId);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      TraceLogger.error("USER", "UPDATE_PROFILE_CONTROLLER_FAILED", traceId, `更新个人资料控制层异常: ${msg}`, error, userId);
      if (msg === "INVALID_NICKNAME" || msg === "INVALID_AVATAR_URL" || msg === "NO_FIELDS_TO_UPDATE") {
        return ApiRes.badRequest(`更新失败: ${msg}`, traceId);
      }
      return ApiRes.internalError("系统更新资料异常，请稍后重试", traceId);
    }
  }

  public async uploadAvatar(request: Request, avatarBucket: R2Bucket, userId: string, traceId: string): Promise<Response> {
    try {
      const formData = await request.formData();
      const file = formData.get("avatar") as File | null;
      if (!file) {
        return ApiRes.badRequest("未上传头像文件", traceId);
      }

      const publicUrl = await this.userService.uploadAvatarToR2({
        file,
        avatarBucket,
        userId,
        traceId,
      });

      return ApiRes.success({ url: publicUrl }, traceId);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      TraceLogger.error("USER", "AVATAR_UPLOAD_CONTROLLER_FAILED", traceId, `头像上传控制层异常: ${msg}`, error, userId);
      if (msg === "ONLY_IMAGES_SUPPORTED" || msg === "FILE_TOO_LARGE") {
        return ApiRes.badRequest(`头像上传失败: ${msg}`, traceId);
      }
      return ApiRes.internalError("头像上传异常，请稍后重试", traceId);
    }
  }

  public async bindInvite(request: Request, userId: string, traceId: string): Promise<Response> {
    try {
      const body = (await request.json()) as BindInviteReq;
      if (!body || !body.inviterId) {
        return ApiRes.badRequest("缺少必要参数: inviterId", traceId);
      }

      await this.creditsService.bindInvite(userId, body, traceId);
      return ApiRes.success({ success: true }, traceId);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      TraceLogger.error("USER", "BIND_INVITE_CONTROLLER_FAILED", traceId, `绑定邀请控制层失败: ${msg}`, error, userId);

      if (msg === "CANNOT_BIND_SELF") {
        return ApiRes.badRequest("不能绑定自己的邀请码哦", traceId);
      }
      if (msg === "INVALID_INVITER_CODE") {
        return ApiRes.badRequest("邀请码无效，请核对后重试", traceId);
      }
      if (msg === "ALREADY_BOUND_OR_USER_MISSING") {
        return ApiRes.badRequest("您已绑定过邀请人，请勿重复操作", traceId);
      }
      if (msg.includes("UNIQUE constraint")) {
        return ApiRes.badRequest("邀请关系已建立，请勿重复操作", traceId);
      }
      return ApiRes.internalError("系统绑定邀请异常，请稍后重试", traceId);
    }
  }

  public async claimAdReward(request: Request, env: { JWT_SECRET: string; DB: D1Database }, userId: string, traceId: string): Promise<Response> {
    try {
      const body = (await request.json()) as AdRewardReq;
      if (!body || !body.adToken) {
        return ApiRes.badRequest("缺少必要参数: adToken", traceId);
      }

      const newBalance = await this.creditsService.claimAdReward(userId, body, env.JWT_SECRET, traceId);
      const adReward = await CreditsConfig.getAdReward(env.DB);
      return ApiRes.success({ addedCredits: adReward, newBalance }, traceId);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      TraceLogger.error("USER", "AD_REWARD_CONTROLLER_FAILED", traceId, `领广告积分控制层失败: ${msg}`, error, userId);

      if (msg.startsWith("TOKEN_VERIFY_FAILED:")) {
        return ApiRes.badRequest(msg.substring(20), traceId);
      }
      if (msg === "AD_REWARD_CLAIMED") {
        return ApiRes.badRequest("该广告奖励已被领用，请勿重复领取", traceId);
      }
      return ApiRes.internalError("系统处理广告奖励异常，请稍后重试", traceId);
    }
  }

  public async getCreditsHistory(request: Request, userId: string, traceId: string): Promise<Response> {
    try {
      const url = new URL(request.url);
      const results = await this.creditsService.getCreditsHistory(userId, url);
      return ApiRes.success(results, traceId);
    } catch (error: unknown) {
      TraceLogger.error("USER", "CREDITS_HISTORY_CONTROLLER_FAILED", traceId, `查询积分流水控制层失败: ${getErrorMessage(error)}`, error, userId);
      return ApiRes.internalError("系统查询积分记录异常", traceId);
    }
  }
}
