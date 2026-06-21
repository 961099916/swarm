/**
 * taskAPI — 任务领域 API 抽象层 (BFF)
 *
 * 注意：微信小程序不支持 TypeScript 语法。
 * 使用 CommonJS + JSDoc 类型标注。
 *
 * @module utils/taskAPI
 */

const { request } = require("./request");

/**
 * @typedef {Object} Task
 * @property {string} id - 任务 ID
 * @property {string} taskType - 任务类型
 * @property {string} status - 任务状态
 * @property {Object} payload - 任务参数
 * @property {number} creditsCost - 消耗积分
 * @property {string|undefined} resultSummary - 结果摘要
 * @property {string} createdAt - 创建时间
 */

/**
 * 创建任务
 * @param {string} taskType - 任务类型
 * @param {Object} payload - 任务参数
 * @returns {Promise<{taskId: string}>}
 */
async function createTask(taskType, payload) {
  const res = await request({ url: "/api/v1/tasks/create", method: "POST", data: { taskType, payload } });
  return res.data;
}

/**
 * 获取任务列表
 * @param {number} [page=1] - 页码
 * @param {number} [pageSize=20] - 每页条数
 * @returns {Promise<Task[]>}
 */
async function listTasks(page = 1, pageSize = 20) {
  const res = await request({ url: `/api/v1/tasks/list?page=${page}&pageSize=${pageSize}` });
  return res.data?.list || [];
}

/**
 * 获取任务日志
 * @param {string} taskId - 任务 ID
 * @returns {Promise<Array<{level: string, message: string, createdAt: string}>>}
 */
async function getTaskLogs(taskId) {
  const res = await request({ url: `/api/v1/tasks/logs?taskId=${taskId}` });
  return res.data || [];
}

module.exports = { createTask, listTasks, getTaskLogs };
