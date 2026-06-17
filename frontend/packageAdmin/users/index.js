const { request } = require("../../utils/request.js");

Page({
  data: {
    theme: "dark",
    users: [],
    loading: false,
    searchQuery: "",
    currentRoleFilter: "ALL",
    statusFilter: "ALL",
    roleFilterOptions: [
      { label: "全部角色", value: "ALL" },
      { label: "FREE", value: "FREE_USER" },
      { label: "VIP", value: "VIP" },
      { label: "ADMIN", value: "ADMIN" }
    ],

    // 模态弹窗状态
    activeModal: "NONE", // NONE, ROLE, CREDITS
    selectedUserId: "",
    targetRole: "FREE_USER",
    creditsDelta: "",
    creditsReason: ""
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

    // 路由安全校验
    const token = wx.getStorageSync("authToken");
    if (!token) {
      wx.reLaunch({
        url: "/pages/login/login"
      });
      return;
    }

    this.loadUsers();
  },

  // 加载用户账户列表
  loadUsers: function () {
    const { searchQuery, currentRoleFilter, statusFilter } = this.data;
    this.setData({ loading: true });

    request({
      url: `/api/v1/admin/users?search=${searchQuery}&role=${currentRoleFilter}&status=${statusFilter}`
    })
      .then((res) => {
        if (res.success && res.data) {
          const users = res.data.map(user => {
            const roleClass = (user.role || "free_user").toLowerCase();
            return {
              ...user,
              roleClass,
              formattedRegTime: this.formatTime(user.created_at)
            };
          });

          this.setData({ users });
        }
      })
      .catch((err) => {
        console.error("加载管理员用户列表出错:", err);
        wx.showToast({ title: "加载列表失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 搜索处理
  onSearchQueryChange: function (e) {
    this.setData({ searchQuery: e.detail.value });
  },

  handleSearch: function () {
    this.loadUsers();
  },

  // 筛选过滤
  onSelectRoleFilter: function (e) {
    const role = e.currentTarget.dataset.filter;
    this.setData({
      currentRoleFilter: role
    }, () => {
      this.loadUsers();
    });
  },

  toggleStatusFilter: function () {
    const nextStatus = this.data.statusFilter === "BANNED" ? "ALL" : "BANNED";
    this.setData({
      statusFilter: nextStatus
    }, () => {
      this.loadUsers();
    });
  },

  // 变更角色 Modal 打开
  onOpenRoleModal: function (e) {
    const id = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u.id === id);
    if (!user) return;

    this.setData({
      activeModal: "ROLE",
      selectedUserId: id,
      targetRole: user.role || "FREE_USER"
    });
  },

  selectTargetRole: function (e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ targetRole: role });
  },

  submitRoleChange: function () {
    const { selectedUserId, targetRole } = this.data;
    if (!selectedUserId) return;

    request({
      url: `/api/v1/admin/users/${selectedUserId}/role`,
      method: "PUT",
      data: { role: targetRole }
    })
      .then((res) => {
        if (res.success) {
          wx.showToast({ title: "角色已更新并强踢下线", icon: "success" });
          this.closeModal();
          this.loadUsers();
        }
      })
      .catch((err) => {
        console.error("更新用户角色出错:", err);
        wx.showToast({ title: err.message || "更新失败", icon: "none" });
      });
  },

  // 调整积分 Modal 打开
  onOpenCreditsModal: function (e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      activeModal: "CREDITS",
      selectedUserId: id,
      creditsDelta: "",
      creditsReason: ""
    });
  },

  onCreditsDeltaChange: function (e) {
    this.setData({ creditsDelta: e.detail.value });
  },

  onCreditsReasonChange: function (e) {
    this.setData({ creditsReason: e.detail.value });
  },

  submitCreditsChange: function () {
    const { selectedUserId, creditsDelta, creditsReason } = this.data;
    const delta = parseInt(creditsDelta);
    if (isNaN(delta) || delta === 0) {
      wx.showToast({ title: "请输入合法的非零数值", icon: "none" });
      return;
    }

    request({
      url: `/api/v1/admin/users/${selectedUserId}/credits`,
      method: "PUT",
      data: {
        delta,
        reason: creditsReason.trim() || "超级管理员后台调整"
      }
    })
      .then((res) => {
        if (res.success) {
          wx.showToast({ title: "积分微调成功", icon: "success" });
          this.closeModal();
          this.loadUsers();
        }
      })
      .catch((err) => {
        console.error("调整积分失败:", err);
        wx.showToast({ title: err.message || "调整失败", icon: "none" });
      });
  },

  // 强制踢下线
  onKickUser: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: "强行踢下线",
      content: "该操作将直接废除该用户在所有容器节点上的 JWT 令牌缓存，使其被迫下线重新验证，是否确定？",
      success: (res) => {
        if (res.confirm) {
          request({
            url: `/api/v1/admin/users/${id}/invalidate`,
            method: "POST"
          })
            .then((apiRes) => {
              if (apiRes.success) {
                wx.showToast({ title: "已强制踢下线" });
                this.loadUsers();
              }
            })
            .catch((err) => {
              console.error("强制踢下线出错:", err);
              wx.showToast({ title: "操作失败", icon: "none" });
            });
        }
      }
    });
  },

  // 封禁与解封
  onToggleBanUser: function (e) {
    const id = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u.id === id);
    if (!user) return;

    const willBan = user.is_banned === 0;
    
    if (willBan) {
      wx.showModal({
        title: "确认封禁用户",
        content: "封禁用户后，该用户将无法登录并中断所有的正在监测的智能体任务，是否确定？",
        editable: true,
        placeholderText: "请输入封禁原因...",
        success: (res) => {
          if (res.confirm) {
            const reason = res.content ? res.content.trim() : "违反智能平台用户使用条例";
            request({
              url: `/api/v1/admin/users/${id}/ban`,
              method: "POST",
              data: {
                isBanned: true,
                reason
              }
            })
              .then((apiRes) => {
                if (apiRes.success) {
                  wx.showToast({ title: "用户已被强行锁死", icon: "success" });
                  this.loadUsers();
                }
              })
              .catch((err) => {
                console.error("封禁用户出错:", err);
                wx.showToast({ title: "封禁失败", icon: "none" });
              });
          }
        }
      });
    } else {
      wx.showModal({
        title: "账号解除封禁",
        content: "确定恢复该用户的正常使用、接口请求与任务调度权限吗？",
        success: (res) => {
          if (res.confirm) {
            request({
              url: `/api/v1/admin/users/${id}/ban`,
              method: "POST",
              data: {
                isBanned: false
              }
            })
              .then((apiRes) => {
                if (apiRes.success) {
                  wx.showToast({ title: "账号解锁成功", icon: "success" });
                  this.loadUsers();
                }
              })
              .catch((err) => {
                console.error("解封账号出错:", err);
                wx.showToast({ title: "解封失败", icon: "none" });
              });
          }
        }
      });
    }
  },

  closeModal: function () {
    this.setData({
      activeModal: "NONE",
      selectedUserId: ""
    });
  },

  formatTime: function (isoStr) {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch (e) {
      return isoStr;
    }
  },
  onSubmitRoleChange: function () { this.submitRoleChange(); },
  onSubmitCreditsChange: function () { this.submitCreditsChange(); },


  onToggleBanned: function (e) {
    const newFilter = this.data.statusFilter === 'BANNED' ? 'ALL' : 'BANNED';
    this.setData({ statusFilter: newFilter }, () => { this.loadUsers(); });
  },


  onSelectFilter: function (e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ currentRoleFilter: filter }, () => { this.loadUsers(); });
  },


});