
// Cloudflare Workers 网关的公网 API 基础路径
const BASE_URL = "https://swarm-gateway.jiuxia.online";

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function request(options) {
  const traceId = generateUUID();
  const token = wx.getStorageSync("authToken") || "";
  
  // 组装 Header
  const header = {
    "Content-Type": "application/json",
    "X-Trace-Id": traceId,
    ...options.header
  };

  // 自动装载 JWT
  if (token) {
    header["Authorization"] = `Bearer ${token}`;
  }

  // 补全 URL 路径
  let url = options.url || "";
  if (!url.startsWith("http")) {
    url = BASE_URL + url;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      url: url,
      header: header,
      success: (res) => {
        const statusCode = res.statusCode;
        const apiRes = res.data || {};

        // 1. 成功拦截
        if (statusCode >= 200 && statusCode < 300) {
          resolve(apiRes);
          return;
        }

        // 2. 401 未授权/强制下线/Token 失效拦截
        if (statusCode === 401) {
          wx.removeStorageSync("authToken");
          wx.removeStorageSync("userInfo");
          
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.isLoggedIn = false;
            app.globalData.userCredits = 0;
            app.globalData.userInfo = null;
          }

          wx.showToast({
            title: apiRes.error || "登录凭证已过期，请重新登录",
            icon: "none",
            duration: 2000
          });

          // 延迟跳转到登录页，让 Toast 显示完
          setTimeout(() => {
            wx.reLaunch({
              url: "/pages/login/login"
            });
          }, 1500);

          reject(new Error(apiRes.error || "未登录"));
          return;
        }

        // 3. 403 越权/封禁拦截
        if (statusCode === 403) {
          wx.showModal({
            title: "账号异常提示",
            content: apiRes.error || "您无权执行此操作，账号可能已被限制",
            showCancel: false,
            confirmText: "确定"
          });
          reject(new Error(apiRes.error || "权限不足"));
          return;
        }

        // 4. 其他错误拦截
        wx.showToast({
          title: apiRes.error || `请求失败 (${statusCode})`,
          icon: "none"
        });
        reject(new Error(apiRes.error || `服务器故障 (状态码: ${statusCode})`));
      },
      fail: (err) => {
        wx.showToast({
          title: "网络连接失败，请检查网络设置",
          icon: "none"
        });
        reject(err);
      }
    });
  });
}

module.exports = {
  request,
  generateUUID,
  BASE_URL
};
