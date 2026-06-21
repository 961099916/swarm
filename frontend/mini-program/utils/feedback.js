'use strict';

/**
 * 交互反馈工具集
 * 包含：触觉反馈、防重复提交、Toast 规范
 */

// ─── 触觉反馈 ───

/**
 * 轻微震动 — 用于按钮点击、切换等常规操作
 */
function lightTap() {
  try {
    wx.vibrateShort({ type: 'light' });
  } catch (_e) {
    // 低版本兼容
  }
}

/**
 * 中等震动 — 用于提交成功、删除确认等
 */
function mediumTap() {
  try {
    wx.vibrateShort({ type: 'medium' });
  } catch (_e) {
    try {
      wx.vibrateShort({});
    } catch (_e2) {}
  }
}

/**
 * 重震动 — 用于危险操作、错误提示
 */
function heavyTap() {
  try {
    wx.vibrateShort({ type: 'heavy' });
  } catch (_e) {}
}

// ─── Toast 规范 ───

/**
 * 成功提示（图标型，1.5s 自动消失）
 */
function toastSuccess(title) {
  wx.showToast({ title, icon: 'success', duration: 1500 });
}

/**
 * 错误提示（文字型，2s 自动消失）
 */
function toastError(title) {
  wx.showToast({ title, icon: 'none', duration: 2000 });
}

/**
 * 加载中提示（模态，需手动关闭）
 */
function toastLoading(title) {
  wx.showLoading({ title: title || '加载中...', mask: true });
}

/**
 * 关闭加载提示
 */
function hideLoading() {
  wx.hideLoading();
}

// ─── 防重复提交 ───

/**
 * 创建一个防重复提交包装器
 * @param {Function} fn 需要防重复的异步函数
 * @param {Object} page 页面实例（用于 setData 控制 loading）
 * @param {string} loadingKey data 中的 loading 字段名
 */
function preventDoubleTap(fn, page, loadingKey = 'submitting') {
  return async function (...args) {
    if (page.data[loadingKey]) return;
    page.setData({ [loadingKey]: true });
    try {
      await fn.apply(page, args);
    } finally {
      page.setData({ [loadingKey]: false });
    }
  };
}

module.exports = {
  lightTap,
  mediumTap,
  heavyTap,
  toastSuccess,
  toastError,
  toastLoading,
  hideLoading,
  preventDoubleTap,
};
