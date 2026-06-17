const { POLLING_INTERVAL_MS } = require("../../utils/constants.js");
const { request } = require("../../utils/request.js");
const { processTaskItem, formatTimeHms } = require("../../utils/taskHelper.js");

Page({
  data: {
    theme: "dark",
    taskId: "",
    taskInfo: {},
    logs: [],
    scrollTop: 0,
    timer: null,
  },

  onLoad: function (options) {
    if (options && options.taskId) {
      this.setData({ taskId: options.taskId });
    }
  },

  onShow: function () {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({
        theme: app.globalData.theme === "light" ? "theme-light" : "",
      });
      app.applyTheme(app.globalData.theme);
    }

    const token = wx.getStorageSync("authToken");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }

    this.startPolling();
  },

  onHide: function () {
    this.clearTimer();
  },

  onUnload: function () {
    this.clearTimer();
  },

  startPolling: function () {
    this.loadLogsAndStatus();

    const timer = setInterval(() => {
      const status = this.data.taskInfo.status;
      if (status === "RUNNING" || status === "PENDING" || !status) {
        this.loadLogsAndStatus();
      }
    }, POLLING_INTERVAL_MS);

    this.setData({ timer });
  },

  clearTimer: function () {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  loadLogsAndStatus: function () {
    const { taskId, logs: oldLogs } = this.data;
    if (!taskId) return Promise.resolve();

    const statusPromise = request({ url: "/api/v1/tasks/list?limit=100" })
      .then((res) => {
        if (res.success && res.data) {
          const currentTask = res.data.find((t) => t.id === taskId);
          if (currentTask) {
            this.setData({
              taskInfo: processTaskItem(currentTask),
            });
          }
        }
      })
      .catch((err) => {
        console.error("加载详情页面任务属性出错:", err);
      });

    const logsPromise = request({ url: `/api/v1/tasks/logs?taskId=${taskId}` })
      .then((res) => {
        if (res.success && res.data) {
          const newLogs = res.data.logs || [];
          const logs = newLogs.map((newLog, idx) => {
            const oldLog = oldLogs[idx];
            return {
              ...newLog,
              formattedTime: formatTimeHms(newLog.createdAt),
              parsed: this.parseMessage(newLog.message),
              expanded: oldLog ? oldLog.expanded : false,
            };
          });
          this.setData({ logs });
          this.scrollToBottom();
        }
      })
      .catch((err) => {
        console.error("加载详情日志出错:", err);
      });

    return Promise.all([statusPromise, logsPromise]);
  },

  scrollToBottom: function () {
    setTimeout(() => {
      const len = this.data.logs.length;
      this.setData({ scrollTop: len * 150 + 500 });
    }, 100);
  },

  toggleLogExpand: function (e) {
    const idx = e.currentTarget.dataset.index;
    const logs = [...this.data.logs];
    if (logs[idx]) {
      logs[idx].expanded = !logs[idx].expanded;
      this.setData({ logs });
    }
  },

  copyResponseText: function (e) {
    const text = e.currentTarget.dataset.text;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: "复制成功", icon: "success" });
      },
    });
  },

  // ─── 日志消息解析 ───

  parseMessage: function (message) {
    if (!message) return { prefix: "", body: "", type: "normal" };

    if (message.startsWith("[AI_CHAT]")) {
      const jsonStr = message.substring(9).trim();
      try {
        const payload = JSON.parse(jsonStr);
        const systemPrompt = this.getSystemPrompt(payload.messages);
        const userMessages = this.getUserMessages(payload.messages);
        return {
          prefix: "",
          body: payload,
          systemPrompt,
          userMessages,
          type: "ai-chat",
        };
      } catch (_e) {
        return {
          prefix: "[AI 推理异常]",
          body: { response: jsonStr, error: "AI 结构化日志协议 JSON 解析失败", success: false },
          type: "ai-chat",
        };
      }
    }

    if (message.startsWith("[主控]")) {
      return { prefix: "[主控协调官]", body: message.substring(4).trim(), type: "supervisor" };
    }

    const toolMatch = message.match(/^\[工具\s*-\s*([^\]]+)\]/);
    if (toolMatch) {
      return {
        prefix: `[工具:${toolMatch[1]}]`,
        body: message.substring(toolMatch[0].length).trim(),
        type: "tool",
      };
    }

    const agentMatch = message.match(/^\[智能体\s*-\s*([^\]]+)\]/);
    if (agentMatch) {
      return {
        prefix: `[智能体:${agentMatch[1]}]`,
        body: message.substring(agentMatch[0].length).trim(),
        type: "agent",
      };
    }

    return { prefix: "", body: message, type: "normal" };
  },

  getSystemPrompt: function (messages) {
    if (!Array.isArray(messages)) return "";
    const sys = messages.find((m) => m.role === "system");
    return sys ? sys.content : "";
  },

  getUserMessages: function (messages) {
    if (!Array.isArray(messages)) return [];
    return messages.filter((m) => m.role === "user" || m.role === "assistant");
  },

  goBack: function () {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: "/pages/task/list/index" });
    }
  },

  onCopyChatContent: function (e) {
    this.copyResponseText(e);
  },

  onToggleChatExpand: function (e) {
    this.toggleLogExpand(e);
  },
});
