const { request } = require("../../utils/request.js");
const listPage = require("../../utils/listPage.js");

/** 管理端任务列表处理器 */
const adminTaskBehavior = listPage.create({
  pageSize: 10,
  fetchData(params) {
    const { page, pageSize, filterValue } = params;
    const offset = (page - 1) * pageSize;
    return request({ url: `/api/v1/admin/tasks?status=${filterValue}&limit=${pageSize}&offset=${offset}` });
  },
  parseList(res) {
    if (!res.success || !res.data) return [];
    return res.data.map(t => this.processTaskItem(t));
  },
  parseTotal(res) {
    return res.data?.total || 0;
  },
  filterOptions: [
    { label: "全部任务", value: "ALL" },
    { label: "运行中", value: "RUNNING" },
    { label: "成功", value: "SUCCESS" },
    { label: "失败", value: "FAILED" },
    { label: "已取消", value: "CANCELLED" },
    { label: "已暂停", value: "SLEEPING" },
  ],
});

Page({
  data: {
    ...adminTaskBehavior.data,
    theme: "dark",
    showSearch: false,
    searchPlaceholder: "搜索任务 ID...",
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

  // 筛选切换
  onFilterChange(e) {
    const value = e.detail?.value || e.currentTarget?.dataset?.value || 'ALL';
    if (value === this.data.filterValue) return;
    this.setData({ filterValue: value, page: 1, hasMore: true, searchQuery: '' });
    this.loadFirstPage();
  },

  loadFirstPage() {
    this.setData({ page: 1, hasMore: true, loading: true, errorMsg: '' });
    this._fetchPage(1, true);
  },

  _fetchPage(page, isRefresh) {
    const offset = (page - 1) * this.data.pageSize;
    const status = this.data.filterValue;
    const search = this.data.searchQuery;

    request({ url: `/api/v1/admin/tasks?status=${status}&limit=${this.data.pageSize}&offset=${offset}&search=${search}` })
      .then((res) => {
        if (!res || !res.success) {
          this.setData({ errorMsg: (res && res.error) || '加载失败', loading: false, refreshing: false });
          return;
        }
        const rawItems = res.data || [];
        const items = rawItems.map(t => this.processTaskItem(t));
        const total = res.data?.total || 0;

        if (isRefresh || page === 1) {
          this.setData({ list: items, total, page: 1, hasMore: items.length >= this.data.pageSize, errorMsg: '' });
        } else {
          const existing = this.data.list || [];
          this.setData({ list: [...existing, ...items], total, page, hasMore: items.length >= this.data.pageSize, errorMsg: '' });
        }
      })
      .catch((err) => {
        console.error('加载管理任务列表出错:', err);
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

  onSearchInput(e) {
    const value = (e.detail?.value || '').trim();
    this.setData({ searchQuery: value, page: 1, hasMore: true });
    this._fetchPage(1, true);
  },

  onSelectFilter(e) {
    this.onFilterChange(e);
  },

  // 取消任务
  onCancelTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '强制取消任务',
      content: '确定取消该任务？',
      success: (res) => {
        if (res.confirm) {
          request({ url: `/api/v1/admin/tasks/${id}/cancel`, method: 'PUT' })
            .then((apiRes) => {
              if (apiRes.success) {
                wx.showToast({ title: '任务已取消', icon: 'success' });
                this.loadFirstPage();
              }
            })
            .catch((err) => console.error('取消任务异常:', err));
        }
      },
    });
  },

  goToDetail(e) {
    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packageTask/detail/index?taskId=${taskId}` });
  },

  processTaskItem(task) {
    const formattedTime = task.created_at ? this.formatTime(task.created_at) : '—';
    const cancellable = ['PENDING', 'RUNNING', 'SLEEPING'].includes(task.status);
    let statusClass = (task.status || 'pending').toLowerCase();
    let statusLabel = task.status || 'PENDING';

    switch (task.status) {
      case 'PENDING': statusLabel = '排队中'; break;
      case 'RUNNING': statusLabel = '运行中'; break;
      case 'SUCCESS': statusLabel = '成功'; break;
      case 'FAILED': statusLabel = '失败'; break;
      case 'CANCELLED': statusLabel = '已取消'; break;
      case 'SLEEPING': statusLabel = '已暂停'; break;
    }

    return { ...task, formattedTime, cancellable, statusClass, statusLabel };
  },

  formatTime(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return isoStr; }
  },
});
