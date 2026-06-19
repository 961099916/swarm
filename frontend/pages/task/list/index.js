const { request } = require("../../../utils/request.js");
const { processTaskItem, formatTaskTime } = require("../../../utils/taskHelper.js");
const { lightTap } = require("../../../utils/feedback.js");
const listPage = require("../../../utils/listPage.js");

/** 任务列表处理器 */
const taskListBehavior = listPage.create({
  pageSize: 10,
  fetchData(params) {
    const { page, pageSize, filterValue } = params;
    const offset = (page - 1) * pageSize;
    let url = `/api/v1/tasks/list?limit=${pageSize}&offset=${offset}`;
    return request({ url });
  },
  parseList(res) {
    if (!res.success || !res.data) return [];
    return (res.data || []).map(processTaskItem);
  },
  filterOptions: [
    { label: "全部任务", value: "ALL" },
    { label: "监控中", value: "RUNNING" },
    { label: "已完成", value: "SUCCESS" },
    { label: "异常", value: "FAILED" },
    { label: "挂起", value: "SLEEPING" },
  ],
});

Page({
  data: {
    ...taskListBehavior.data,
    theme: "dark",
    userCredits: 0,
    filteredTasks: [],
    stats: { total: 0, running: 0, success: 0, failed: 0 },
    avatarColors: {},
  },

  onShow() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({
        theme: app.globalData.theme === "light" ? "theme-light" : "",
        userCredits: app.globalData.userCredits,
      });
      app.applyTheme(app.globalData.theme);
    }

    const token = wx.getStorageSync("authToken");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }

    // 同步用户积分
    request({ url: "/api/v1/user/profile" })
      .then((res) => {
        if (res.success && res.data) {
          this.setData({ userCredits: res.data.credits });
          const app = getApp();
          if (app && app.globalData) app.globalData.userCredits = res.data.credits;
        }
      })
      .catch(() => {});

    this.loadFirstPage();
  },

  // 筛选切换（覆盖 listPage 的筛选方法，触发重算 stats）
  onFilterChange(e) {
    const value = e.detail?.value || e.currentTarget?.dataset?.value || 'ALL';
    if (value === this.data.filterValue) return;
    this.setData({ filterValue: value, page: 1, hasMore: true });
    this.loadFirstPage();
  },

  // 刷新 — 联动 stats 计算
  onRefresh() {
    this.setData({ refreshing: true });
    // 同时刷新积分
    request({ url: "/api/v1/user/profile" }).then((res) => {
      if (res.success && res.data) this.setData({ userCredits: res.data.credits });
    }).catch(() => {});
    // 用 listPage 的刷新
    taskListBehavior.onRefresh.call(this);
  },

  // 重写 loadFirstPage：load 完成后计算 stats
  loadFirstPage() {
    // listPage 的数据已经通过 data 合并，但 load 方法需要重写
    // 用 taskListBehavior 的方法但 wrap callback
    this.setData({ page: 1, hasMore: true, loading: true, errorMsg: '' });
    this._fetchPage(1, true);
  },

  // 重写 _fetchPage 以加入 stats 计算 和 filteredList
  _fetchPage(page, isRefresh) {
    const params = {
      page,
      pageSize: this.data.pageSize,
      searchQuery: this.data.searchQuery,
      filterValue: this.data.filterValue,
    };

    const offset = (page - 1) * this.data.pageSize;
    let url = `/api/v1/tasks/list?limit=${this.data.pageSize}&offset=${offset}`;

    request({ url })
      .then((res) => {
        if (!res || !res.success) {
          this.setData({ errorMsg: (res && res.error) || '加载失败', loading: false, refreshing: false });
          return;
        }
        const rawItems = res.data || [];
        const items = rawItems.map(processTaskItem);

        if (isRefresh || page === 1) {
          this.setData({
            list: items,
            page: 1,
            hasMore: items.length >= this.data.pageSize,
            errorMsg: '',
          });
        } else {
          const existing = this.data.list || [];
          this.setData({
            list: [...existing, ...items],
            page,
            hasMore: items.length >= this.data.pageSize,
            errorMsg: '',
          });
        }
        // 更新统计和筛选列表
        this._updateFilteredAndStats();
      })
      .catch((err) => {
        console.error('加载任务列表失败:', err);
        this.setData({ errorMsg: err.message || '网络异常', loading: false, refreshing: false });
      })
      .finally(() => {
        this.setData({ loading: false, refreshing: false });
        if (typeof wx.stopPullDownRefresh === 'function') wx.stopPullDownRefresh();
      });
  },

  // 从 list + filterValue 计算 filteredTasks 和 stats
  _updateFilteredAndStats() {
    const { list, filterValue } = this.data;
    const filtered = filterValue === 'ALL' ? list : list.filter(t => t.status === filterValue);
    const running = list.filter(t => t.status === 'RUNNING').length;
    const success = list.filter(t => t.status === 'SUCCESS').length;
    const failed = list.filter(t => t.status === 'FAILED').length;
    this.setData({
      filteredTasks: filtered,
      stats: { total: list.length, running, success, failed },
    });
  },

  // 上拉加载更多
  loadNextPage() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    this._fetchPage(this.data.page + 1, false);
  },

  // 搜索
  onSearchInput(e) {
    const value = (e.detail?.value || '').trim();
    this.setData({ searchQuery: value, page: 1, hasMore: true });
    this._fetchPage(1, true);
  },

  goToCredits() {
    lightTap();
    wx.switchTab({ url: "/pages/credits/index" });
  },

  goToDeploy() {
    lightTap();
    wx.switchTab({ url: "/pages/deploy/index" });
  },

  goToDetail(e) {
    lightTap();
    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packageTask/detail/index?taskId=${taskId}` });
  },

  // 错误重试
  onRetry() {
    lightTap();
    this.loadFirstPage();
  },

  formatTime: formatTaskTime,

  onPullDownRefresh() {
    this.onRefresh();
  },

  onReachBottom() {
    this.loadNextPage();
  },

  onShareAppMessage() {
    return { title: "Swarm 智能体任务管理系统", path: "/pages/task/list/index" };
  },
});
