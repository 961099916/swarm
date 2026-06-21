"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalHistoryService = void 0;
const logger_1 = require("./logger");
const STORAGE_KEY = 'local_test_history';
class LocalHistoryService {
    /**
     * 获取本地所有的测试历史（按时间倒序）
     */
    static getHistoryList() {
        try {
            return wx.getStorageSync(STORAGE_KEY) || [];
        }
        catch (e) {
            logger_1.Logger.error('读取本地历史记录失败:', e);
            return [];
        }
    }
    /**
     * 保存一条新历史记录（带防超限淘汰策略）
     */
    static saveHistory(item) {
        try {
            const list = this.getHistoryList();
            list.unshift(item); // 插入到头部（最前面）
            // 防御设计：若记录数过多（比如超过50条），滑动窗口自动淘汰最老的记录
            if (list.length > 50) {
                list.pop();
                logger_1.Logger.warn('本地历史存储记录超过50条，已自动清理最旧的历史记录');
            }
            wx.setStorageSync(STORAGE_KEY, list);
            logger_1.Logger.info(`本地历史记录已安全保存, ID: ${item.historyId}`);
        }
        catch (error) {
            logger_1.Logger.error('保存本地历史记录捕获到超限异常，尝试执行应急降级清理', error);
            // 如果依然抛出异常（如空间完全占满），强制清空老旧记录，重新尝试写入
            this.clearOldestHalf();
            try {
                const list = this.getHistoryList();
                list.unshift(item);
                wx.setStorageSync(STORAGE_KEY, list);
            }
            catch (retryErr) {
                logger_1.Logger.error('降级清理后重新写入依然失败，本次记录放弃持久化:', retryErr);
            }
        }
    }
    /**
     * 删除单条本地历史记录
     */
    static deleteHistory(historyId) {
        try {
            const list = this.getHistoryList();
            const newList = list.filter(item => item.historyId !== historyId);
            wx.setStorageSync(STORAGE_KEY, newList);
            logger_1.Logger.info(`本地历史记录已删除, ID: ${historyId}`);
        }
        catch (e) {
            logger_1.Logger.error('删除本地历史记录异常:', e);
        }
    }
    /**
     * 应急方案：清除最老的一半记录
     */
    static clearOldestHalf() {
        try {
            const list = this.getHistoryList();
            if (list.length > 2) {
                const halfList = list.slice(0, Math.floor(list.length / 2));
                wx.setStorageSync(STORAGE_KEY, halfList);
                logger_1.Logger.warn('已应急清除 50% 的历史记录缓存以释放存储空间。');
            }
        }
        catch (e) {
            logger_1.Logger.error('应急释放空间失败:', e);
        }
    }
}
exports.LocalHistoryService = LocalHistoryService;
