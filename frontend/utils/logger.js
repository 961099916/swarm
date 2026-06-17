"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;

/**
 * 微信小程序全局结构化日志输出工具
 * 全链路 TraceID 透传：每条日志携带全局 traceId
 */
class Logger {
  static getTraceId() {
    try {
      const app = getApp();
      return app?.globalData?.traceId || "SYSTEM_DEFAULT";
    } catch {
      return "INIT_STAGE";
    }
  }

  static info(message, ...args) {
    console.log(`[TraceID: ${this.getTraceId()}] [INFO] ${message}`, ...args);
  }

  static warn(message, ...args) {
    console.warn(`[TraceID: ${this.getTraceId()}] [WARN] ${message}`, ...args);
  }

  static error(message, error, ...args) {
    console.error(`[TraceID: ${this.getTraceId()}] [ERROR] ${message}`, error, ...args);
  }
}
exports.Logger = Logger;
