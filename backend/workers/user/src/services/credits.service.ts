// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/services/credits.service.ts

import { BindInviteReq, AdRewardReq, CreditsConfig } from "@swarm/credits";
import { TraceLogger } from "@swarm/kernel";
import { UserRepository } from "../repositories/user.repository";
import { verifyAdToken } from "../utils/security";
import { UserConstants } from "../constants/user.constant";

export class CreditsService {
  constructor(private userRepo: UserRepository) {}

  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  public async bindInvite(userId: string, body: BindInviteReq, traceId: string): Promise<void> {
    const { inviterId } = body;
    if (inviterId === userId) {
      throw new Error("CANNOT_BIND_SELF");
    }

    const inviter = await this.userRepo.findUserById(inviterId);
    if (!inviter) {
      throw new Error("INVALID_INVITER_CODE");
    }

    const db = this.userRepo.db;
    const inviteReward = await CreditsConfig.getInviteReward(db);

    const now = new Date().toISOString();
    await this.userRepo.executeBindInviteTransaction({
      userId,
      inviterId,
      inviteReward,
      now,
    });

    TraceLogger.info("USER", "BIND_INVITE_SUCCESS", traceId, `邀请关系绑定成功: 邀请人=${inviterId}`, userId);
  }

  public async claimAdReward(userId: string, body: AdRewardReq, jwtSecret: string, traceId: string): Promise<number> {
    const { adToken } = body;

    // 1. 安全校验：验证广告令牌的签名、用户归属、时效重放
    const verifyRes = await verifyAdToken(adToken, jwtSecret, userId, traceId);
    if (!verifyRes.success) {
      throw new Error(`TOKEN_VERIFY_FAILED:${verifyRes.errorMsg || "广告令牌校验失败"}`);
    }

    // 2. 计算 Token 哈希值用于去重
    const tokenHash = await this.sha256(adToken);

    const db = this.userRepo.db;
    const adReward = await CreditsConfig.getAdReward(db);

    // 3. 执行物理事务发放积分并记录流水
    const now = new Date().toISOString();
    const newBalance = await this.userRepo.executeAdRewardTransaction({
      userId,
      tokenHash,
      adReward,
      now,
    });

    return newBalance;
  }

  public async getCreditsHistory(userId: string, url: URL) {
    const type = url.searchParams.get("type") || UserConstants.FLOW_TYPE_ALL;
    const limit = Math.min(UserConstants.FLOW_MAX_LIMIT, parseInt(url.searchParams.get("limit") || String(UserConstants.FLOW_DEFAULT_LIMIT)));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));

    return await this.userRepo.findCreditsHistory({
      userId,
      type,
      limit,
      offset,
    });
  }
}
