'use strict';

/**
 * 头像工具函数
 * 统一管理 avatar 校验逻辑，消除三个页面间的重复代码
 */

/** t-icon 图标名校验正则（只允许字母、数字、中划线、下划线） */
const ICON_NAME_RE = /^[\w-]+$/;

/** 默认图标 */
const DEFAULT_ICON = 'service';

/**
 * 校验头像值是否合法（防 XSS 注入）
 *
 * @param {string} avatar - 原始头像值
 * @returns {string} 安全的 t-icon 图标名称
 *
 * @example
 * validateAvatar('user')     // => 'user'
 * validateAvatar('<script>') // => 'service'
 * validateAvatar(null)       // => 'service'
 */
function validateAvatar(avatar) {
  if (!avatar || !ICON_NAME_RE.test(avatar)) {
    return DEFAULT_ICON;
  }
  return avatar;
}

module.exports = {
  validateAvatar,
  DEFAULT_ICON,
};
