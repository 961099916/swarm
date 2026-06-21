const { request, BASE_URL } = require("../../utils/request.js");
const { lightTap, mediumTap } = require("../../utils/feedback.js");

Page({
  data: {
    theme: "dark",
    loading: true,
    isDark: true,
    user: null,
    registerDays: 0,
    inviteCode: "",
    loggingOut: false,
    showEditModal: false,
    editNickname: '',
    editAvatarUrl: '',
    savingProfile: false
  },

  onShow: function () {
    // 同步全局主题模式与状态
    const app = getApp();
    if (app && app.globalData) {
      const theme = app.globalData.theme;
      this.setData({
        theme: theme === "light" ? "theme-light" : "",
        _raw: theme,
        isDark: theme === "dark"
      });
      app.applyTheme(theme);
    }

    // 路由安全守卫
    const token = wx.getStorageSync("authToken");
    if (!token) {
      wx.reLaunch({
        url: "/pages/login/login"
      });
      return;
    }

    this.syncProfile();
  },

  onPullDownRefresh: function () {
    this.syncProfile().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShareAppMessage: function () {
    const { user } = this.data;
    return {
      title: "Swarm 智能体任务管理系统",
      path: `/pages/login/login?inviterId=${user ? user.id : ""}`
    };
  },

  // 获取用户最新 Profile 并处理展示所需计算字段
  syncProfile: function () {
    return request({ url: "/api/v1/user/profile" })
      .then((res) => {
        if (res.success && res.data) {
          const user = res.data;
          
          // 计算角色显示与样式 Class
          let roleLabel = user.role || "FREE_USER";
          let roleClass = (user.role || "free_user").toLowerCase();
          if (user.role === "FREE_USER") roleLabel = "免费订阅";
          else if (user.role === "VIP") roleLabel = "高级企业会员";
          else if (user.role === "ADMIN") roleLabel = "集群超级管理员";

          const processedUser = {
            ...user,
            roleLabel,
            roleClass
          };

          // 计算注册天数
          let registerDays = 0;
          if (user.created_at) {
            const created = new Date(user.created_at);
            const now = new Date();
            const diff = now.getTime() - created.getTime();
            registerDays = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
          }

          // 提取前 8 位作邀请码
          const inviteCode = user.id ? user.id.slice(0, 8).toUpperCase() : "";

          this.setData({
            user: processedUser,
            registerDays,
            inviteCode,
            loading: false
          });

          // 同步积分到全局
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.userCredits = user.credits || 0;
            app.globalData.userInfo = {
              id: user.id,
              name: user.nickname,
              avatar: user.avatarUrl
            };
          }
        }
      })
      .catch((err) => {
        console.error("同步个人资料出错:", err);
      });
  },

  // 切换主题模式
  toggleTheme: function () {
    lightTap();
    const app = getApp();
    if (app && app.toggleTheme) {
      const nextTheme = app.toggleTheme();
      this.setData({
        theme: nextTheme === "light" ? "theme-light" : "",
        _raw: nextTheme,
        isDark: nextTheme === "dark"
      });
    }
  },

  copyInviteCode: function () {
    const { inviteCode } = this.data;
    if (!inviteCode) return;
    wx.setClipboardData({
      data: inviteCode,
      success: () => {
        wx.showToast({ title: "邀请码已复制", icon: "success" });
      }
    });
  },

  goToVip: function () {
    wx.showModal({
      title: "升级高级会员专属特权",
      content: "企业会员可享24小时高频度全天候监控，无限智能体编排数量，并享受最优先的AI算力通道。因小程序端内支付限制，当前请联系客服免费激活！",
      showCancel: false,
      confirmText: "了解详情"
    });
  },

  goToCredits: function () {
    wx.navigateTo({
      url: "/pages/credits/index"
    });
  },

  goToAgentManager: function () {
    wx.navigateTo({
      url: "/packageTask/agent/manager/index"
    });
  },

  // 安全退出登录
  handleLogout: function () {
    wx.showModal({
      title: "确认退出",
      content: "退出后需要重新授权登录。",
      success: (modalRes) => {
        if (modalRes.confirm) {
          this.setData({ loggingOut: true });
          
          request({
            url: "/api/v1/auth/logout",
            method: "POST"
          })
            .catch((err) => {
              console.warn("请求登出接口失败，本地强制清理:", err);
            })
            .finally(() => {
              // 清除本地缓存与全局
              wx.removeStorageSync("authToken");
              wx.removeStorageSync("userInfo");
              
              const app = getApp();
              if (app && app.globalData) {
                app.globalData.isLoggedIn = false;
                app.globalData.userCredits = 0;
                app.globalData.userInfo = null;
              }

              this.setData({ loggingOut: false });

              wx.showToast({
                title: "已安全登出",
                icon: "none"
              });

              setTimeout(() => {
                wx.reLaunch({
                  url: "/pages/login/login"
                });
              }, 1000);
            });
        }
      }
    });
  },

  // 打开编辑资料弹窗
  onEditProfile: function () {
    this.setData({
      editNickname: this.data.user ? this.data.user.nickname : '',
      editAvatarUrl: '',
      showEditModal: true
    });
  },

  onEditPopupChange: function (e) {
    if (e.detail && !e.detail.visible) {
      this.setData({ showEditModal: false });
    }
  },

  onCloseEdit: function () {
    this.setData({ showEditModal: false, savingProfile: false });
  },

  // 选择微信头像
  onChooseAvatar: function (e) {
    if (e.detail && e.detail.avatarUrl) {
      const tempPath = e.detail.avatarUrl;

      // 上传临时头像文件到 R2 永久存储
      wx.showLoading({ title: '上传头像中...' });

      const token = wx.getStorageSync("authToken") || "";

      wx.uploadFile({
        url: BASE_URL + '/api/v1/user/avatar',
        filePath: tempPath,
        name: 'avatar',
        header: { 'Authorization': 'Bearer ' + token },
        success: (res) => {
          wx.hideLoading();
          try {
            const data = JSON.parse(res.data);
            if (data.success) {
              const fullUrl = BASE_URL + data.data.url;
              this.setData({ editAvatarUrl: fullUrl });
              wx.showToast({ title: '头像已上传', icon: 'success' });
            } else {
              wx.showToast({ title: data.error || '头像上传失败', icon: 'none' });
            }
          } catch (parseErr) {
            wx.showToast({ title: '服务器响应异常', icon: 'none' });
          }
        },
        fail: function () {
          wx.hideLoading();
          wx.showToast({ title: '网络异常，头像上传失败', icon: 'none' });
        }
      });
    }
  },

  // 昵称输入
  onEditNicknameInput: function (e) {
    this.setData({ editNickname: e.detail.value });
  },

  // 保存个人资料
  onSaveProfile: function () {
    const { editNickname, editAvatarUrl, user } = this.data;
    const newNickname = editNickname !== undefined ? editNickname.trim() : null;
    const newAvatar = editAvatarUrl || null;

    if (!newNickname && !newAvatar) {
      wx.showToast({ title: '请修改昵称或头像', icon: 'none' });
      return;
    }

    if (newNickname && (!newNickname || newNickname.length < 1)) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (newNickname && newNickname.length > 30) {
      wx.showToast({ title: '昵称不能超过30个字符', icon: 'none' });
      return;
    }

    this.setData({ savingProfile: true });
    const { request } = require("../../utils/request.js");

    const data = {};
    if (newNickname) data.nickname = newNickname;
    if (newAvatar) data.avatarUrl = newAvatar;

    request({
      url: "/api/v1/user/profile",
      method: "PUT",
      data: data
    })
      .then((res) => {
        if (res.success) {
          wx.showToast({ title: "保存成功", icon: "success" });
          this.setData({ showEditModal: false, savingProfile: false });
          if (user) {
            const updatedUser = { ...user };
            if (newNickname) updatedUser.nickname = newNickname;
            if (newAvatar) updatedUser.avatarUrl = newAvatar;
            this.setData({ user: updatedUser });
          }
          // 同步到全局
          const app = getApp();
          if (app && app.globalData) {
            if (newNickname) app.globalData.userInfo.name = newNickname;
          }
        } else {
          wx.showToast({ title: res.error || "保存失败", icon: "none" });
          this.setData({ savingProfile: false });
        }
      })
      .catch((err) => {
        console.error("保存个人资料失败:", err);
        wx.showToast({ title: "服务请求异常", icon: "none" });
        this.setData({ savingProfile: false });
      });
  },
});
