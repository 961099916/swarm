/**
 * agentAPI — 智能体领域 API 抽象层 (BFF)
 *
 * @module utils/agentAPI
 * @typedef {Object} Agent
 * @property {string} id
 * @property {string} name
 * @property {string} avatar
 * @property {string} role
 * @property {string} systemPrompt
 * @property {string} model
 * @property {string[]} tools
 * @property {boolean} isPreset
 * @property {string} createdAt
 */

const { request } = require("./request");

/** 获取智能体列表 */
async function listAgents() {
  const res = await request({ url: "/api/v1/agents/list" });
  return res.data || [];
}

/** 创建智能体 */
async function createAgent(data) {
  const res = await request({ url: "/api/v1/agents/create", method: "POST", data });
  return res.data;
}

/** 更新智能体 */
async function updateAgent(data) {
  await request({ url: "/api/v1/agents/update", method: "PUT", data });
}

/** 删除智能体 */
async function deleteAgent(id) {
  await request({ url: `/api/v1/agents/delete?id=${id}`, method: "DELETE" });
}

module.exports = { listAgents, createAgent, updateAgent, deleteAgent };
