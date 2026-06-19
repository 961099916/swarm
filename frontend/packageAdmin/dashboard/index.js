const { request } = require("../../utils/request.js");

Page({
  data: {
    theme: "dark",
    stats: null
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

    // 安全认证守卫
    const token = wx.getStorageSync("authToken");
    if (!token) {
      wx.reLaunch({
        url: "/pages/login/login"
      });
      return;
    }

    // 角色守卫：非管理员重定向到主页
    const userInfo = wx.getStorageSync("userInfo") || {};
    if (userInfo.role !== "ADMIN") {
      wx.showToast({ title: "仅管理员可访问", icon: "none" });
      wx.switchTab({ url: "/pages/task/list/index" });
      return;
    }

    this.loadStats();
  },

  loadStats: function () {
    // 角色前置守卫：非管理员不请求统计数据
    const app = getApp();
    const userInfo = app && app.globalData && app.globalData.userInfo;
    const storedUser = wx.getStorageSync("userInfo");
    const userRole = (storedUser && storedUser.role) || (userInfo && userInfo.role);
    if (userRole !== "ADMIN") {
      console.warn("[Admin Dashboard] 非管理员用户，跳过统计数据加载");
      return;
    }

    request({ url: "/api/v1/admin/stats" })
      .then((res) => {
        if (res.success && res.data) {
          this.setData({
            stats: res.data
          });
        }
      })
      .catch((err) => {
        console.error("加载管理大盘统计数据失败:", err);
        wx.showToast({ title: "加载系统数据失败", icon: "none" });
      });
  },

  goToUsers: function () {
    wx.navigateTo({ url: "/packageAdmin/users/index" });
  },

  goToTasks: function () {
    wx.navigateTo({ url: "/packageAdmin/tasks/index" });
  },

  goToAgents: function () {
    wx.navigateTo({ url: "/packageAdmin/agents/index" });
  },
  
  goToTools: function () {
    wx.navigateTo({ url: "/packageAdmin/tools/index" });
  },

  goToKnowledge: function () {
    wx.navigateTo({ url: "/packageAdmin/knowledge/index" });
  }
});