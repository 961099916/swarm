const { request } = require("../../../utils/request.js");
const { processTaskItem, formatTaskTime } = require("../../../utils/taskHelper.js");

Page({
  data: {
    theme: "dark",
    tasks: [],
    filteredTasks: [],
    loading: false,
    currentFilter: "ALL",
    userCredits: 0,
    stats: {
      total: 0,
      running: 0,
      success: 0,
    },
    filterOptions: [
      { label: "全部任务", value: "ALL" },
      { label: "监控中", value: "RUNNING" },
      { label: "已完成", value: "SUCCESS" },
      { label: "异常", value: "FAILED" },
      { label: "挂起", value: "SLEEPING" },
    ],
  },

  onShow: function () {
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

    this.loadData();
  },

  onPullDownRefresh: function () {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadData: function () {
    this.setData({ loading: true });

    const profilePromise = request({ url: "/api/v1/user/profile" })
      .then((res) => {
        if (res.success && res.data) {
          this.setData({ userCredits: res.data.credits });
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.userCredits = res.data.credits;
          }
        }
      })
      .catch((err) => {
        console.error("加载个人资料失败:", err);
      });

    const tasksPromise = request({ url: "/api/v1/tasks/list?limit=100" })
      .then((res) => {
        if (res.success && res.data) {
          const tasks = res.data.map(processTaskItem);
          this.setData({ tasks });
          this.calculateStatsAndFilter();
        }
      })
      .catch((err) => {
        console.error("加载任务列表失败:", err);
        wx.showToast({ title: "获取任务列表失败", icon: "none" });
      });

    return Promise.all([profilePromise, tasksPromise]).finally(() => {
      this.setData({ loading: false });
    });
  },

  calculateStatsAndFilter: function () {
    const { tasks, currentFilter } = this.data;
    const running = tasks.filter((t) => t.status === "RUNNING").length;
    const success = tasks.filter((t) => t.status === "SUCCESS").length;
    const failed = tasks.filter((t) => t.status === "FAILED").length;
    const total = tasks.length;

    let filteredTasks = tasks;
    if (currentFilter !== "ALL") {
      filteredTasks = tasks.filter((t) => t.status === currentFilter);
    }

    this.setData({
      filteredTasks,
      stats: { total, running, success, failed },
    });
  },

  onSelectFilter: function (e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ currentFilter: filter }, () => {
      this.calculateStatsAndFilter();
    });
  },

  goToCredits: function () {
    wx.switchTab({ url: "/pages/credits/index" });
  },

  goToDeploy: function () {
    wx.switchTab({ url: "/pages/deploy/index" });
  },

  goToDetail: function (e) {
    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packageTask/detail/index?taskId=${taskId}` });
  },

  formatTime: formatTaskTime,

  onShareAppMessage: function () {
    return {
      title: "Swarm 智能体任务管理系统",
      path: "/pages/task/list/index",
    };
  },
});
