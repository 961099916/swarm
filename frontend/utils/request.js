/**
 * 网络请求封装
 * - 统一 TraceId 透传（利用 WeChat 随机数 API）
 * - JWT 自动装载
 * - 401/403 全局拦截跳转
 * - 统一错误提示
 */
'use strict';

/** Cloudflare Workers 网关的公网 API 基础路径 */
const BASE_URL = 'https://swarm-gateway.jiuxia.online';

/**
 * 使用 wx.getRandomValues 生成密码学安全的 UUID v4
 * 提供 122 位真实随机性（符合 UUID v4 规范）
 * 基础库 2.25.4+ 生效，低版本静默降级到 Math.random
 * @returns {string} UUID v4 字符串
 */
function generateUUID() {
  try {
    // wx.getRandomValues 返回 ArrayBuffer（基础库 2.25.4+ 同步 API）
    const buffer = wx.getRandomValues({ length: 16 });
    if (buffer && buffer.byteLength === 16) {
      const arr = new Uint8Array(buffer);
      // 设版本号（第 7 字节高 4 位 = 0100 = 0x40）
      arr[6] = (arr[6] & 0x0f) | 0x40;
      // 设变体（第 9 字节高 2 位 = 10 = 0x80）
      arr[8] = (arr[8] & 0x3f) | 0x80;

      const hex = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  } catch (_e) {
    // 静默降级到 Math.random
  }
  return _fallbackUUID();
}

/**
 * UUID v4 降级方案（基于 Math.random，52 位随机性）
 * @returns {string}
 */
function _fallbackUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 统一网络请求
 * @param {object} options - 请求参数
 * @param {string} options.url - API 路径（自动补全 BASE_URL）
 * @param {string} [options.method='GET'] - HTTP 方法
 * @param {object} [options.data] - 请求体
 * @param {object} [options.header] - 额外请求头
 * @returns {Promise<object>} 响应数据
 */
function request(options) {
  const traceId = generateUUID();
  const token = wx.getStorageSync('authToken') || '';

  /** @type {WechatMiniprogram.RequestOption} */
  const header = {
    'Content-Type': 'application/json',
    'X-Trace-Id': traceId,
    ...options.header,
  };

  // 自动装载 JWT
  if (token) {
    header['Authorization'] = `Bearer ${token}`;
  }

  // 补全 URL
  let url = options.url || '';
  if (!url.startsWith('http')) {
    url = BASE_URL + url;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      url,
      header,
      success: (res) => {
        const { statusCode } = res;
        const apiRes = res.data || {};

        // 提取消息字段：新格式用 message，旧格式兼容 error
        const errMsg = apiRes.message || apiRes.error || '';

        // ─── 基于业务状态码判断 ───
        // code === 0 一律视为成功，`res.success === true` 兼容前端各页面检查
        if (apiRes.code === 0) {
          resolve({ ...apiRes, success: true });
          return;
        }

        // ─── 业务错误码处理 ───
        const bizCode = apiRes.code || 0;

        // 1000-1099: 请求参数错误
        if (bizCode >= 1000 && bizCode < 1010) {
          wx.showToast({ title: errMsg || '请求参数错误', icon: 'none' });
          reject(new Error(errMsg));
          return;
        }

        // 1010-1012: 未认证 / Token 过期
        if (bizCode >= 1010 && bizCode <= 1012) {
          wx.removeStorageSync('authToken');
          wx.removeStorageSync('userInfo');
          try {
            const app = getApp();
            if (app && app.globalData) {
              app.globalData.isLoggedIn = false;
              app.globalData.userCredits = 0;
              app.globalData.userInfo = null;
            }
          } catch (_e) { /* 静默 */ }

          wx.showToast({
            title: errMsg || '登录凭证已过期，请重新登录',
            icon: 'none',
            duration: 2000,
          });

          setTimeout(() => {
            wx.reLaunch({ url: '/pages/login/login' });
          }, 1500);

          reject(new Error(errMsg || '未登录'));
          return;
        }

        // 1020: 权限不足
        if (bizCode === 1020) {
          wx.showModal({
            title: '账号异常提示',
            content: errMsg || '您无权执行此操作，账号可能已被限制',
            showCancel: false,
            confirmText: '确定',
          });
          reject(new Error(errMsg || '权限不足'));
          return;
        }

        // 1030: 资源不存在
        if (bizCode === 1030) {
          wx.showToast({ title: errMsg || '资源不存在', icon: 'none' });
          reject(new Error(errMsg));
          return;
        }

        // 1040: 资源冲突
        if (bizCode === 1040) {
          wx.showToast({ title: errMsg || '操作冲突', icon: 'none' });
          reject(new Error(errMsg));
          return;
        }

        // 1050: 频率限制
        if (bizCode === 1050) {
          wx.showToast({ title: errMsg || '操作过于频繁，请稍后重试', icon: 'none', duration: 2000 });
          reject(new Error(errMsg));
          return;
        }

        // 2100: 积分不足
        if (bizCode === 2100) {
          wx.showToast({ title: errMsg || '积分不足', icon: 'none' });
          reject(new Error(errMsg));
          return;
        }

        // 421 请求被错误定向（Cloudflare Workers 部署/路由配置异常）
        if (statusCode === 421) {
          wx.showModal({
            title: '服务路由异常',
            content: 'API 网关路由配置异常，请联系管理员检查 Cloudflare Workers 部署状态',
            showCancel: false,
            confirmText: '确定',
          });
          reject(new Error('服务路由错误 (421): 请确认 Worker 已部署且路由配置正确'));
          return;
        }

        // ─── 兜底：基于 HTTP 状态码兼容旧格式 ───
        // 旧格式: 2xx 成功
        if (statusCode >= 200 && statusCode < 300) {
          resolve(apiRes);
          return;
        }

        // 旧格式: 401 未授权（兜底）
        if (statusCode === 401) {
          wx.removeStorageSync('authToken');
          wx.removeStorageSync('userInfo');
          try {
            const app = getApp();
            if (app && app.globalData) {
              app.globalData.isLoggedIn = false;
              app.globalData.userCredits = 0;
              app.globalData.userInfo = null;
            }
          } catch (_e) { /* 静默 */ }

          wx.showToast({
            title: errMsg || '登录凭证已过期，请重新登录',
            icon: 'none',
            duration: 2000,
          });

          setTimeout(() => {
            wx.reLaunch({ url: '/pages/login/login' });
          }, 1500);

          reject(new Error(errMsg || '未登录'));
          return;
        }

        // 旧格式: 403 越权
        if (statusCode === 403) {
          wx.showModal({
            title: '账号异常提示',
            content: errMsg || '您无权执行此操作，账号可能已被限制',
            showCancel: false,
            confirmText: '确定',
          });
          reject(new Error(errMsg || '权限不足'));
          return;
        }

        // 其他错误
        wx.showToast({
          title: errMsg || `请求失败 (${statusCode})`,
          icon: 'none',
        });
        reject(new Error(errMsg || `服务器故障 (状态码: ${statusCode})`));
      },
      fail: (err) => {
        wx.showToast({
          title: '网络连接失败，请检查网络设置',
          icon: 'none',
        });
        reject(err);
      },
    });
  });
}

module.exports = {
  request,
  generateUUID,
  BASE_URL,
};
