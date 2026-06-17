/**
 * 前端业务常量
 * 
 * 集中管理轮询间隔、延迟时间等魔法值。
 */
"use strict";

/** 任务详情页轮询间隔 (ms) */
const POLLING_INTERVAL_MS = 2500;

/** 登录成功后重定向延迟 (ms) */
const LOGIN_REDIRECT_DELAY_MS = 1000;

/** Toast 显示持续时间 (ms) */
const TOAST_DURATION_MS = 2000;

module.exports = {
  POLLING_INTERVAL_MS,
  LOGIN_REDIRECT_DELAY_MS,
  TOAST_DURATION_MS,
};
