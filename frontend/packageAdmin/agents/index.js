const { request } = require("../../utils/request.js");
const { validateAvatar } = require("../../utils/avatar.js");

const AI_MODELS = {
  SMALL: "meta-llama/Llama-3.2-3B-Instruct",
  DEFAULT: "meta-llama/Llama-3.1-8B-Instruct"
};

Page({
  data: {
    theme: "dark",
    agents: [],
    loading: false,
    refreshing: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    errorMsg: '',
    searchQuery: "",
    saving: false,

    // 弹窗状态
    showModal: false,
    editingAgentId: "",
    AI_MODELS: AI_MODELS,
    form: {
      name: "",
      avatar: "",
      role: "",
      systemPrompt: "",
      model: AI_MODELS.SMALL,
      toolsWebFetch: false,
      toolsEmailNotify: false
    }
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

    this.loadFirstPage();
  },

  loadFirstPage: function () {
    this.setData({ page: 1, hasMore: true, loading: true, errorMsg: '', agents: [] });
    this.loadData();
  },

  onRefresh: function () {
    this.setData({ refreshing: true, errorMsg: '' });
    this.loadData();
  },

  onSearchInput: function (e) {
    const value = (e.detail?.value || '').trim();
    this.setData({ searchQuery: value, page: 1, hasMore: true });
    this.filterAgents();
  },

  // 获取全局所有智能体
  loadData: function () {
    this.setData({ loading: true, errorMsg: '' });
    request({ url: "/api/v1/admin/agents" })
    request({ url: "/api/v1/admin/agents" })
      .then((res) => {
        if (res.success && res.data) {
          const agents = res.data.map(agent => ({
            ...agent,
            avatar: validateAvatar(agent.avatar),
            formattedModel: this.formatModel(agent.model),
            shortUid: this.formatUid(agent.userId)
          }));

          this.setData({ agents }, () => {
            this.filterAgents();
          });
        } else {
          this.setData({ errorMsg: (res && res.error) || '加载失败' });
        }
      })
      .catch((err) => {
        console.error("加载全局智能体审计列表失败:", err);
        this.setData({ errorMsg: '网络异常，请稍后重试' });
      })
      .finally(() => {
        this.setData({ loading: false, refreshing: false });
      });
  },

  filterAgents: function () {
    const { agents, searchQuery } = this.data;
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      this.setData({ filteredAgents: agents });
      return;
    }

    const filtered = agents.filter(a => {
      const nameMatch = a.name ? a.name.toLowerCase().includes(query) : false;
      const roleMatch = a.role ? a.role.toLowerCase().includes(query) : false;
      const userIdMatch = a.userId ? a.userId.toLowerCase().includes(query) : false;
      return nameMatch || roleMatch || userIdMatch;
    });

    this.setData({ filteredAgents: filtered });
  },

  onSearchQueryChange: function (e) {
    this.setData({ searchQuery: e.detail.value }, () => {
      this.filterAgents();
    });
  },

  formatModel: function (modelStr) {
    if (!modelStr) return "";
    const parts = modelStr.split("/");
    return parts[parts.length - 1] || modelStr;
  },

  formatUid: function (uid) {
    if (!uid) return "";
    if (uid.length <= 12) return uid;
    return uid.substring(0, 6) + "..." + uid.substring(uid.length - 6);
  },

  onCopyUid: function (e) {
    const uid = e.currentTarget.dataset.uid;
    if (!uid) return;
    wx.setClipboardData({
      data: uid,
      success: () => {
        wx.showToast({ title: "用户 ID 已复制", icon: "success" });
      }
    });
  },

  onOpenEditModal: function (e) {
    const id = e.currentTarget.dataset.id;
    const agent = this.data.agents.find(a => a.id === id);
    if (!agent) return;

    const tools = agent.tools || [];
    this.setData({
      editingAgentId: id,
      showModal: true,
      form: {
        name: agent.name || "",
        avatar: agent.avatar || "",
        role: agent.role || "",
        systemPrompt: agent.systemPrompt || "",
        model: agent.model || AI_MODELS.SMALL,
        toolsWebFetch: tools.includes("web_fetch"),
        toolsEmailNotify: tools.includes("email_notify")
      }
    });
  },

  closeModal: function () {
    this.setData({ showModal: false });
  },

  onNameChange: function (e) {
    this.setData({ "form.name": e.detail.value });
  },
  onAvatarChange: function (e) {
    this.setData({ "form.avatar": e.detail.value });
  },
  onRoleChange: function (e) {
    this.setData({ "form.role": e.detail.value });
  },
  onPromptChange: function (e) {
    this.setData({ "form.systemPrompt": e.detail.value });
  },

  onSelectModel: function (e) {
    const model = e.currentTarget.dataset.model;
    this.setData({ "form.model": model });
  },

  toggleTool: function (e) {
    const tool = e.currentTarget.dataset.tool;
    if (tool === "web_fetch") {
      this.setData({ "form.toolsWebFetch": !this.data.form.toolsWebFetch });
    } else if (tool === "email_notify") {
      this.setData({ "form.toolsEmailNotify": !this.data.form.toolsEmailNotify });
    }
  },

  // 强行修改保存
  handleAdminSave: function () {
    const { form, editingAgentId } = this.data;
    
    if (!form.name.trim()) {
      wx.showToast({ title: "请输入智能体名称", icon: "none" });
      return;
    }
    if (!form.role.trim()) {
      wx.showToast({ title: "请输入职责描述", icon: "none" });
      return;
    }
    if (!form.systemPrompt.trim()) {
      wx.showToast({ title: "请输入系统指令", icon: "none" });
      return;
    }

    const tools = [];
    if (form.toolsWebFetch) tools.push("web_fetch");
    if (form.toolsEmailNotify) tools.push("email_notify");

    this.setData({ saving: true });

    request({
      url: "/api/v1/admin/agents/update",
      method: "PUT",
      data: {
        agentId: editingAgentId,
        name: form.name.trim(),
        avatar: form.avatar.trim() || "",
        role: form.role.trim(),
        systemPrompt: form.systemPrompt.trim(),
        model: form.model,
        tools: tools
      }
    })
      .then((res) => {
        if (res.success) {
          wx.showToast({ title: "强制修改保存成功", icon: "success" });
          this.setData({ showModal: false });
          this.loadData();
        } else {
          wx.showToast({ title: res.error || "强制修改失败", icon: "none" });
        }
      })
      .catch((err) => {
        console.error("管理员强行保存智能体异常:", err);
        wx.showToast({ title: err.message || "强制保存出错", icon: "none" });
      })
      .finally(() => {
        this.setData({ saving: false });
      });
  },

  // 强制下线删除
  onForceDelete: function (e) {
    const agentId = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: "强制下线警告",
      content: `您正在以系统管理员特权强制下线智能体 [${name}]。下线后，该创建者及其他已部署的协同工作流中将不再能选用此智能体，历史已归档任务不受影响。`,
      cancelText: "取消",
      confirmText: "强制下线",
      confirmColor: "#ff3b30",
      success: (modalRes) => {
        if (modalRes.confirm) {
          request({
            url: `/api/v1/admin/agents/delete?agentId=${agentId}`,
            method: "DELETE"
          })
            .then((res) => {
              if (res.success) {
                wx.showToast({ title: "该智能体已被下线", icon: "success" });
                this.loadData();
              } else {
                wx.showToast({ title: res.error || "下线失败", icon: "none" });
              }
            })
            .catch((err) => {
              console.error("管理员下线智能体发生异常:", err);
              wx.showToast({ title: "下线失败", icon: "none" });
            });
        }
      }
    });
  },
  onEditAgent: function (e) { this.onOpenEditModal(e); },
  onSaveAgent: function (e) { this.handleAdminSave(e); }
});