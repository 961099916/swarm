'use strict';

/**
 * 微信小程序全局结构化日志输出工具
 * 全链路 TraceID 透传：每条日志携带全局 traceId
 */
class Logger {
  /**
   * 获取当前全局 TraceID
   * @returns {string}
   */
  static getTraceId() {
    try {
      const app = getApp();
      return (app && app.globalData && app.globalData.traceId) || 'SYSTEM_DEFAULT';
    } catch (_e) {
      return 'INIT_STAGE';
    }
  }

  /**
   * 信息日志
   * @param {string} message
   * @param {...any} args
   */
  static info(message, ...args) {
    console.log(`[TraceID: ${this.getTraceId()}] [INFO] ${message}`, ...args);
  }

  /**
   * 警告日志
   * @param {string} message
   * @param {...any} args
   */
  static warn(message, ...args) {
    console.warn(`[TraceID: ${this.getTraceId()}] [WARN] ${message}`, ...args);
  }

  /**
   * 错误日志
   * @param {string} message
   * @param {*} [error]
   * @param {...any} args
   */
  static error(message, error, ...args) {
    console.error(`[TraceID: ${this.getTraceId()}] [ERROR] ${message}`, error, ...args);
  }
}

module.exports = { Logger };
