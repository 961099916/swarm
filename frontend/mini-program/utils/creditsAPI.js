/**
 * creditsAPI — 积分经济领域 API 抽象层 (BFF)
 *
 * @module utils/creditsAPI
 */

const { request } = require("./request");

/** 绑定邀请人 */
async function bindInvite(inviterId) {
  await request({ url: "/api/v1/credits/bind-invite", method: "POST", data: { inviterId } });
}

/** 广告奖励 */
async function rewardAd(adToken) {
  const res = await request({ url: "/api/v1/credits/reward", method: "POST", data: { adToken } });
  return res.data;
}

/** 获取积分流水 */
async function getCreditsHistory(page = 1, pageSize = 50) {
  const res = await request({ url: `/api/v1/credits/history?page=${page}&pageSize=${pageSize}` });
  return res.data?.list || [];
}

module.exports = { bindInvite, rewardAd, getCreditsHistory };
