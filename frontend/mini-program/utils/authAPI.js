/**
 * authAPI — 身份认证领域 API 抽象层 (BFF)
 *
 * @module utils/authAPI
 * @typedef {Object} UserInfo
 * @property {string} id
 * @property {string|null} nickname
 * @property {string|null} avatarUrl
 * @property {string} role
 * @property {number} credits
 */

const { request } = require("./request");

/** 微信登录 */
async function login(code) {
  const res = await request({ url: "/api/v1/auth/login", method: "POST", data: { code } });
  return res.data;
}

/** 获取用户信息 */
async function getUserProfile() {
  const res = await request({ url: "/api/v1/user/profile" });
  return res.data;
}

module.exports = { login, getUserProfile };
