const { request, generateUUID } = require("../../utils/request.js");
const listPage = require("../../utils/listPage.js");

Page({
  data: {
    ...listPage.create({
      pageSize: 10,
      filterOptions: [
        { label: "全部账单", value: "ALL" },
        { label: "算力补给", value: "INCOME" },
        { label: "资源消耗", value: "OUTCOME" },
      ],
      fetchData(params) {
        const { page, pageSize, filterValue } = params;
        const offset = (page - 1) * pageSize;
        const type = filterValue === 'ALL' ? 'ALL' : filterValue;
        return request({ url: `/api/v1/credits/history?type=${type}&limit=${pageSize}&offset=${offset}` });
      },
      parseList(res) {
        if (!res.success || !res.data) return [];
        return res.data.map(item => ({
          ...item,
          reasonLabel: this.getReasonLabel(item.reason),
          timeOnly: this.formatTimeOnly(item.created_at),
        }));
      },
    }).data,
    theme: '',
    userCredits: 100,
    adLoading: false,
    showMockAd: false,
    adCountdown: 5,
    adProgressWidth: '0%',
    showSearch: false,
    groupedList: [],
    typeOptions: [
      { label: "全部账单", value: "ALL" },
      { label: "算力补给", value: "INCOME" },
      { label: "资源消耗", value: "OUTCOME" },
    ],
  },

  onShow() {
    const app = getApp();
    const currentTheme = app.globalData.theme;
    app.applyTheme(currentTheme);
    this.setData({ theme: currentTheme === 'light' ? 'theme-light' : '', userCredits: app.globalData.userCredits });
    this.syncProfile();
    this.loadFirstPage();
  },

  syncProfile() {
    request({ url: "/api/v1/user/profile" }).then((res) => {
      if (res.success && res.data) {
        const app = getApp();
        app.globalData.userCredits = res.data.credits;
        this.setData({ userCredits: res.data.credits });
      }
    }).catch(() => {});
  },

  loadFirstPage() {
    this.setData({ page: 1, hasMore: true, loading: true, errorMsg: '', list: [] });
    this._fetchPage(1, true);
  },

  _fetchPage(page, isRefresh) {
    const offset = (page - 1) * this.data.pageSize;
    const type = this.data.filterValue === 'ALL' ? 'ALL' : this.data.filterValue;

    request({ url: `/api/v1/credits/history?type=${type}&limit=${this.data.pageSize}&offset=${offset}` })
      .then((res) => {
        if (!res || !res.success) {
          this.setData({ errorMsg: (res && res.error) || '加载失败', loading: false, refreshing: false });
          return;
        }
        const rawItems = res.data || [];
        const items = rawItems.map(item => ({
          ...item,
          reasonLabel: this.getReasonLabel(item.reason),
          timeOnly: this.formatTimeOnly(item.created_at),
        }));

        if (isRefresh || page === 1) {
          this.setData({ list: items, groupedList: this.groupLedgers(items), page: 1, hasMore: items.length >= this.data.pageSize, errorMsg: '' });
        } else {
          const merged = [...(this.data.list || []), ...items];
          this.setData({ list: merged, groupedList: this.groupLedgers(merged), page, hasMore: items.length >= this.data.pageSize, errorMsg: '' });
        }
      })
      .catch((err) => {
        console.error('加载积分流水失败:', err);
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
    this._fetchPage(this.data.page + 1, false);
  },

  onRefresh() {
    this.setData({ refreshing: true });
    this.syncProfile();
    this._fetchPage(1, true);
  },

  onFilterChange(e) {
    const value = e.detail?.value || e.currentTarget?.dataset?.value || 'ALL';
    if (value === this.data.filterValue) return;
    this.setData({ filterValue: value, page: 1, hasMore: true });
    this._fetchPage(1, true);
  },

  // ↓ 原有方法保持不动 ↓

  playVideoAd() {
    if (this.data.adLoading || this.data.showMockAd) return;
    this.setData({ adLoading: true, showMockAd: true, adCountdown: 5, adProgressWidth: "0%" });
    const interval = setInterval(() => {
      const countdown = this.data.adCountdown - 1;
      const progress = `${((5 - countdown) / 5) * 100}%`;
      this.setData({ adCountdown: countdown, adProgressWidth: progress });
      if (countdown <= 0) {
        clearInterval(interval);
        this.setData({ showMockAd: false });
        this.claimAdCredits();
      }
    }, 1000);
  },

  onAdVisibleChange(e) { this.setData({ showMockAd: e.detail.visible }); },

  claimAdCredits() {
    const mockToken = `mock_ad_token_${generateUUID()}_${Date.now()}`;
    request({ url: "/api/v1/credits/reward", method: "POST", data: { adToken: mockToken } })
      .then((res) => {
        if (res.success && res.data) {
          wx.showToast({ title: "补给成功 +20 积分", icon: "success", duration: 2000 });
          const app = getApp();
          app.globalData.userCredits = res.data.newBalance;
          this.setData({ userCredits: res.data.newBalance });
        } else {
          wx.showToast({ title: res.error || "获取补给失败", icon: "none" });
        }
      })
      .catch((err) => console.error("发分失败:", err))
      .finally(() => this.setData({ adLoading: false }));
  },

  getReasonLabel(reason) {
    switch (reason) {
      case "TASK_COST": return "编排分布式智能体";
      case "AD_REWARD": return "看板激励算力补给";
      case "INVITE_BONUS": return "邀请好友推广奖励";
      case "ADMIN_ADJUST": return "系统管理员后台调配";
      default: return reason;
    }
  },

  formatTimeOnly(isoStr) {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    } catch { return isoStr; }
  },

  groupLedgers(list) {
    const groups = {};
    list.forEach(item => {
      const dateStr = this.formatGroupDate(item.created_at);
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });
    return Object.keys(groups).map(date => ({ date, items: groups[date] }));
  },

  formatGroupDate(isoStr) {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    } catch { return isoStr; }
  },

  onShareAppMessage() {
    const app = getApp();
    return { title: "Swarm 智能体任务管理系统", path: `/pages/login/login?inviterId=${app.globalData.userInfo?.id || ""}` };
  },

  onReachBottom() { this.loadNextPage(); },
  onPullDownRefresh() { this.onRefresh(); },
});
