const { LOGIN_REDIRECT_DELAY_MS } = require("../../utils/constants.js");
const { request } = require("../../utils/request.js");

Page({
  data: {
    theme: "dark",
    loading: false,
    inviteCode: "",
    inviterIdFromUrl: ""
  },

  onLoad: function (options) {
    if (options && options.inviterId) {
      this.setData({
        inviterIdFromUrl: options.inviterId
      });
      console.log("检测到邀请人 ID:", options.inviterId);
    }
  },

  onShow: function () {
    // 同步全局主题模式
    const app = getApp();
    if (app && app.globalData) {
      this.setData({
        theme: app.globalData.theme === 'light' ? 'theme-light' : ''
      });
      app.applyTheme(app.globalData.theme);
    }

    // 检测本地是否已有 Token，校验有效性后免密重定向
    const token = wx.getStorageSync("authToken");
    if (token) {
      this.tryAutoLogin();
    }
  },

  /** 尝试验证本地 Token 是否仍然有效，有效则跳过登录页 */
  tryAutoLogin: function () {
    request({ url: "/api/v1/user/profile" })
      .then((res) => {
        if (res.success && res.data) {
          // Token 有效，同步用户信息后跳转
          wx.setStorageSync("userInfo", res.data);
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.isLoggedIn = true;
            app.globalData.userCredits = res.data.credits || 0;
            app.globalData.userInfo = {
              id: res.data.id,
              name: res.data.nickname,
              avatar: res.data.avatarUrl
            };
          }
          wx.reLaunch({ url: "/pages/task/list/index" });
        }
      })
      .catch(() => {
        // Token 失效，留在登录页
        wx.removeStorageSync("authToken");
        wx.removeStorageSync("userInfo");
        console.log("本地 Token 已失效，停留在登录页");
      });
  },

  // 输入框双向绑定模拟
  onInviteCodeChange: function (e) {
    this.setData({
      inviteCode: e.detail.value
    });
  },

  // 微信授权一键登录
  handleWeixinLogin: function () {
    if (this.data.loading) return;
    this.setData({ loading: true });

    wx.login({
      provider: "weixin",
      success: (loginRes) => {
        if (!loginRes.code) {
          wx.showToast({ title: "微信登录获取 Code 失败", icon: "none" });
          this.setData({ loading: false });
          return;
        }
        this.executeLogin(loginRes.code);
      },
      fail: (err) => {
        console.error("微信登录失败:", err);
        wx.showToast({ title: "调用微信登录授权失败", icon: "none" });
        this.setData({ loading: false });
      }
    });
  },

  // 执行登录网络请求
  executeLogin: function (code) {
    const reqData = { code };

    if (this.data.inviterIdFromUrl) {
      reqData.inviterId = this.data.inviterIdFromUrl;
    }
    if (this.data.inviteCode.trim()) {
      reqData.inviterId = this.data.inviteCode.trim();
    }

    request({
      url: "/api/v1/auth/login",
      method: "POST",
      data: reqData
    })
      .then((res) => {
        if (res.success && res.data) {
          wx.setStorageSync("authToken", res.data.token);
          wx.setStorageSync("userInfo", res.data.user);

          // 同步给 app.js globalData
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.isLoggedIn = true;
            app.globalData.userCredits = res.data.user.credits || 0;
            app.globalData.userInfo = {
              id: res.data.user.id,
              name: res.data.user.nickname,
              avatar: res.data.user.avatarUrl
            };
          }

          wx.showToast({
            title: "登录成功",
            icon: "success",
            duration: LOGIN_REDIRECT_DELAY_MS
          });

          setTimeout(() => {
            wx.reLaunch({
              url: "/pages/task/list/index"
            });
          }, LOGIN_REDIRECT_DELAY_MS);
        } else {
          wx.showToast({
            title: res.error || "登录失败",
            icon: "none"
          });
        }
      })
      .catch((err) => {
        console.error("接口登录请求异常:", err);
        wx.showToast({
          title: err.message || "服务请求异常",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  viewAgreement: function () {
    wx.showModal({
      title: "用户协议",
      content: "此处为智能体工作台用户协议详情，实际项目中可跳转H5或富文本页面。",
      showCancel: false
    });
  },

  viewPrivacy: function () {
    wx.showModal({
      title: "隐私政策",
      content: "此处为智能体工作台隐私政策详情，实际项目中可跳转H5或富文本页面。",
      showCancel: false
    });
  }
});
