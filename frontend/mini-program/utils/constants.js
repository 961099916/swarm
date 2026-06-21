'use strict';

/**
 * 前端业务常量
 *
 * 集中管理轮询间隔、延迟时间、路由路径、API 接口路径等魔法值。
 */

// ─── 时间常量 ───

/** 任务详情页轮询间隔 (ms) */
const POLLING_INTERVAL_MS = 2500;

/** 登录成功后重定向延迟 (ms) */
const LOGIN_REDIRECT_DELAY_MS = 1000;

/** Toast 显示持续时间 (ms) */
const TOAST_DURATION_MS = 2000;

// ─── 路由路径 ───

/** @type {{ [key: string]: string }} */
const ROUTES = {
  LOGIN: '/pages/login/login',
  DEPLOY: '/pages/deploy/index',
  TASK_LIST: '/pages/task/list/index',
  TASK_DETAIL: '/packageTask/detail/index',
  AGENT_MANAGER: '/packageTask/agent/manager/index',
  CREDITS: '/pages/credits/index',
  PROFILE: '/pages/profile/index',
};

// ─── API 接口路径 ───

/** @type {{ [key: string]: string }} */
const API = {
  AGENTS_LIST: '/api/v1/agents/list',
  TASKS_CREATE: '/api/v1/tasks/create',
  TASKS_LIST: '/api/v1/tasks/list',
  TASKS_DETAIL: '/api/v1/tasks/detail',
};

// ─── API 错误码映射 ───

const ERROR_MESSAGES = {
  401: '登录凭证已过期，请重新登录',
  403: '您无权执行此操作，账号可能已被限制',
  404: '请求的资源不存在',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误，请稍后重试',
  NETWORK: '网络连接失败，请检查网络设置',
  UNKNOWN: '服务请求异常',
};

module.exports = {
  POLLING_INTERVAL_MS,
  LOGIN_REDIRECT_DELAY_MS,
  TOAST_DURATION_MS,
  ROUTES,
  API,
  ERROR_MESSAGES,
};
