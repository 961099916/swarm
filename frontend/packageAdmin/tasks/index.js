const { request } = require("../../utils/request.js");

Page({
  data: {
    theme: "dark",
    tasks: [],
    loading: false,
    currentStatusFilter: "ALL",
    statusFilterOptions: [
      { label: "全部任务", value: "ALL" },
      { label: "运行中", value: "RUNNING" },
      { label: "成功", value: "SUCCESS" },
      { label: "失败", value: "FAILED" },
      { label: "已取消", value: "CANCELLED" },
      { label: "已暂停", value: "SLEEPING" }
    ]
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

    this.loadTasks();
  },

  // 加载系统级全部任务
  loadTasks: function () {
    const { currentStatusFilter } = this.data;
    this.setData({ loading: true });

    request({
      url: `/api/v1/admin/tasks?status=${currentStatusFilter}&limit=100`
    })
      .then((res) => {
        if (res.success && res.data) {
          const tasks = res.data.map(task => this.processTaskItem(task));
          this.setData({ tasks });
        }
      })
      .catch((err) => {
        console.error("加载全局任务列表出错:", err);
        wx.showToast({ title: "加载系统任务失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  processTaskItem: function (task) {
    const formattedTime = this.formatTime(task.created_at);
    const cancellable = task.status === "PENDING" || task.status === "RUNNING" || task.status === "SLEEPING";

    let statusClass = (task.status || "pending").toLowerCase();
    let statusLabel = task.status || "PENDING";
    let statusDot = "○";

    switch (task.status) {
      case "PENDING":
        statusLabel = "排队中";
        statusDot = "time";
        break;
      case "RUNNING":
        statusLabel = "运行中";
        statusDot = "play-circle-filled";
        break;
      case "SUCCESS":
        statusLabel = "成功";
        statusDot = "check-circle-filled";
        break;
      case "FAILED":
        statusLabel = "失败";
        statusDot = "close-circle-filled";
        break;
      case "CANCELLED":
        statusLabel = "已取消";
        statusDot = "error-circle-filled";
        break;
      case "SLEEPING":
        statusLabel = "已暂停";
        statusDot = "control-platform";
        break;
    }

    return {
      ...task,
      formattedTime,
      cancellable,
      statusClass,
      statusLabel,
      statusDot
    };
  },

  onSelectFilter: function (e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({
      currentStatusFilter: filter
    }, () => {
      this.loadTasks();
    });
  },

  // 强行取消执行流任务
  onCancelTask: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: "强制取消任务",
      content: "该操作将强行下线容器内运行的智能体任务，并归档至失败/已取消状态，是否确定？",
      success: (res) => {
        if (res.confirm) {
          request({
            url: `/api/v1/admin/tasks/${id}/cancel`,
            method: "PUT"
          })
            .then((apiRes) => {
              if (apiRes.success) {
                wx.showToast({ title: "任务已被取消", icon: "success" });
                this.loadTasks();
              }
            })
            .catch((err) => {
              console.error("取消任务异常:", err);
              wx.showToast({ title: "操作失败", icon: "none" });
            });
        }
      }
    });
  },

  goToDetail: function (e) {
    const taskId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/packageTask/detail/index?taskId=${taskId}`
    });
  },

  onPreventDefault: function () {
    // 阻止卡片点击穿透事件
  },

  formatTime: function (isoStr) {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch (e) {
      return isoStr;
    }
  }
});