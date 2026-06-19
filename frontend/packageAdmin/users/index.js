const { request } = require("../../utils/request.js");

Page({
  data: {
    theme: "dark",
    users: [],
    loading: false,
    refreshing: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    errorMsg: '',
    searchQuery: "",
    currentRoleFilter: "ALL",
    statusFilter: "ALL",
    roleFilterOptions: [
      { label: "全部角色", value: "ALL" },
      { label: "FREE", value: "FREE_USER" },
      { label: "VIP", value: "VIP" },
      { label: "ADMIN", value: "ADMIN" }
    ],
    activeModal: "NONE",
    selectedUserId: "",
    targetRole: "FREE_USER",
    creditsDelta: "",
    creditsReason: ""
  },

  onShow() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ theme: app.globalData.theme === 'light' ? 'theme-light' : '' });
      app.applyTheme(app.globalData.theme);
    }
    const token = wx.getStorageSync("authToken");
    if (!token) { wx.reLaunch({ url: "/pages/login/login" }); return; }
    this.loadFirstPage();
  },

  loadFirstPage() {
    this.setData({ page: 1, hasMore: true, loading: true, errorMsg: '', users: [] });
    this._loadPage(1, true);
  },

  _loadPage(page, isRefresh) {
    const offset = (page - 1) * this.data.pageSize;
    const { searchQuery, currentRoleFilter, statusFilter } = this.data;

    request({ url: `/api/v1/admin/users?search=${searchQuery}&role=${currentRoleFilter}&status=${statusFilter}&limit=${this.data.pageSize}&offset=${offset}` })
      .then((res) => {
        if (!res || !res.success) {
          this.setData({ errorMsg: (res && res.error) || '加载失败', loading: false, refreshing: false });
          return;
        }
        const raw = res.data || [];
        const users = raw.map(u => {
          const roleClass = (u.role || "free_user").toLowerCase();
          let roleLabel = u.role || "FREE_USER";
          if (u.role === "FREE_USER") roleLabel = "免费";
          else if (u.role === "VIP") roleLabel = "高级";
          else if (u.role === "ADMIN") roleLabel = "管理员";
          return { ...u, roleClass, roleLabel };
        });

        if (isRefresh || page === 1) {
          this.setData({ users, page: 1, hasMore: users.length >= this.data.pageSize, errorMsg: '' });
        } else {
          this.setData({ users: [...this.data.users, ...users], page, hasMore: users.length >= this.data.pageSize, errorMsg: '' });
        }
      })
      .catch((err) => {
        console.error("加载用户列表失败:", err);
        this.setData({ errorMsg: err.message || '网络异常', loading: false, refreshing: false });
      })
      .finally(() => {
        this.setData({ loading: false, refreshing: false });
        if (typeof wx.stopPullDownRefresh === 'function') wx.stopPullDownRefresh();
      });
  },

  loadNextPage() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    this._loadPage(this.data.page + 1, false);
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this._loadPage(1, true);
  },

  onSearchInput(e) {
    const value = (e.detail?.value || '').trim();
    this.setData({ searchQuery: value, page: 1, hasMore: true });
    this._loadPage(1, true);
  },

  onSelectRoleFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    if (filter === this.data.currentRoleFilter) return;
    this.setData({ currentRoleFilter: filter, page: 1, hasMore: true });
    this._loadPage(1, true);
  },

  // ↓ 以下原方法保持不动 ↓
  onOpenRoleModal(e) { this.setData({ activeModal: "ROLE", selectedUserId: e.currentTarget.dataset.id, targetRole: "FREE_USER" }); },
  onOpenCreditsModal(e) { this.setData({ activeModal: "CREDITS", selectedUserId: e.currentTarget.dataset.id, creditsDelta: '', creditsReason: '' }); },
  closeModal() { this.setData({ activeModal: "NONE" }); },

  selectTargetRole(e) { this.setData({ targetRole: e.currentTarget.dataset.role }); },

  onSubmitRoleChange() {
    const { selectedUserId, targetRole } = this.data;
    request({ url: `/api/v1/admin/users/${selectedUserId}/role`, method: "PUT", data: { role: targetRole } })
      .then((res) => {
        if (res.success) { wx.showToast({ title: "角色已更改", icon: "success" }); this.closeModal(); this.loadFirstPage(); }
        else { wx.showToast({ title: res.error || "修改失败", icon: "none" }); }
      }).catch(() => wx.showToast({ title: "请求异常", icon: "none" }));
  },

  onCreditsDeltaInput(e) { this.setData({ creditsDelta: e.detail.value }); },
  onCreditsReasonInput(e) { this.setData({ creditsReason: e.detail.value }); },

  onSubmitCreditsChange() {
    const delta = parseInt(this.data.creditsDelta, 10);
    if (isNaN(delta) || delta === 0) { wx.showToast({ title: "请输入有效的积分值", icon: "none" }); return; }
    request({ url: `/api/v1/admin/users/${this.data.selectedUserId}/credits`, method: "PUT", data: { delta, reason: this.data.creditsReason || "ADMIN_ADJUST" } })
      .then((res) => {
        if (res.success) { wx.showToast({ title: "积分已调整", icon: "success" }); this.closeModal(); this.loadFirstPage(); }
        else { wx.showToast({ title: res.error || "调整失败", icon: "none" }); }
      }).catch(() => wx.showToast({ title: "请求异常", icon: "none" }));
  },

  onKickUser(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({ title: "强制下线", content: "确定要强制该用户下线吗？", success: (r) => {
      if (r.confirm) {
        request({ url: `/api/v1/admin/users/${id}/invalidate`, method: "PUT" })
          .then((res) => { if (res.success) { wx.showToast({ title: "已强制下线", icon: "success" }); this.loadFirstPage(); } })
          .catch(() => wx.showToast({ title: "操作失败", icon: "none" }));
      }
    }});
  },

  onToggleBanUser(e) {
    const id = e.currentTarget.dataset.id;
    const isBanned = e.currentTarget.dataset.banned === 1 ? 0 : 1;
    wx.showModal({ title: isBanned ? "封禁用户" : "解封用户", content: `确定要${isBanned ? '封禁' : '解封'}该用户吗？`, success: (r) => {
      if (r.confirm) {
        request({ url: `/api/v1/admin/users/${id}/ban`, method: "PUT", data: { isBanned } })
          .then((res) => { if (res.success) { wx.showToast({ title: isBanned ? "已封禁" : "已解封", icon: "success" }); this.loadFirstPage(); } })
          .catch(() => wx.showToast({ title: "操作失败", icon: "none" }));
      }
    }});
  },

  onPullDownRefresh() { this.onRefresh(); },
  onReachBottom() { this.loadNextPage(); },
});
