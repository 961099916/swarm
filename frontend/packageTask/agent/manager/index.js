const { request } = require("../../../utils/request.js");

const AI_MODELS = {
  SMALL: "meta-llama/Llama-3.2-3B-Instruct",
  DEFAULT: "meta-llama/Llama-3.1-8B-Instruct"
};

Page({
  data: {
    theme: "dark",
    agents: [],
    customAgents: [],
    presetAgents: [],
    loading: false,
    saving: false,
    
    // 弹窗表单状态
    showModal: false,
    isEditMode: false,
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
    // 同步全局主题
    const app = getApp();
    if (app && app.globalData) {
      this.setData({
        theme: app.globalData.theme === 'light' ? 'theme-light' : ''
      });
      app.applyTheme(app.globalData.theme);
    }

    // 安全检查
    const token = wx.getStorageSync("authToken");
    if (!token) {
      wx.reLaunch({
        url: "/pages/login/login"
      });
      return;
    }

    this.loadData();
  },

  // 加载智能体大盘列表
  loadData: function () {
    this.setData({ loading: true });
    request({ url: "/api/v1/agents/list" })
      .then((res) => {
        if (res.success && res.data) {
          const agents = res.data.map(agent => ({
            ...agent,
            avatar: this.validateAvatar(agent.avatar),
            formattedModel: this.formatModel(agent.model)
          }));

          const presetAgents = agents.filter(a => a.isPreset);
          const customAgents = agents.filter(a => !a.isPreset);

          this.setData({
            agents,
            presetAgents,
            customAgents
          });
        }
      })
      .catch((err) => {
        console.error("加载智能体列表失败:", err);
        wx.showToast({ title: "加载智能体失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  validateAvatar: function (avatar) {
    if (!avatar) return "service";
    // 检测是否为旧版表情字符
    const EMOJI_REGEX = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2b50]/;
    if (EMOJI_REGEX.test(avatar)) {
      return "service";
    }
    return avatar;
  },

  formatModel: function (modelStr) {
    if (!modelStr) return "";
    const parts = modelStr.split("/");
    return parts[parts.length - 1] || modelStr;
  },

  // 展开新增弹窗
  openCreateModal: function () {
    this.setData({
      isEditMode: false,
      editingAgentId: "",
      showModal: true,
      form: {
        name: "",
        avatar: "",
        role: "",
        systemPrompt: "",
        model: AI_MODELS.SMALL,
        toolsWebFetch: false,
        toolsEmailNotify: false
      }
    });
  },

  // 展开编辑弹窗
  onOpenEditModal: function (e) {
    const agentId = e.currentTarget.dataset.id;
    const agent = this.data.agents.find(a => a.id === agentId);
    if (!agent) return;

    const tools = agent.tools || [];
    this.setData({
      isEditMode: true,
      editingAgentId: agentId,
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

  // 表单受控事件绑定
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

  // 创造/更新智能体配置
  handleSave: function () {
    const { form, isEditMode, editingAgentId } = this.data;
    
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

    const dataPayload = {
      name: form.name.trim(),
      avatar: form.avatar.trim() || "",
      role: form.role.trim(),
      systemPrompt: form.systemPrompt.trim(),
      model: form.model,
      tools: tools
    };

    this.setData({ saving: true });

    let savePromise;
    if (isEditMode) {
      dataPayload.agentId = editingAgentId;
      savePromise = request({
        url: "/api/v1/agents/update",
        method: "PUT",
        data: dataPayload
      });
    } else {
      savePromise = request({
        url: "/api/v1/agents/create",
        method: "POST",
        data: dataPayload
      });
    }

    savePromise
      .then((res) => {
        if (res.success) {
          wx.showToast({
            title: isEditMode ? "配置更新成功" : "智能体创造成功",
            icon: "success"
          });
          this.setData({ showModal: false });
          this.loadData();
        } else {
          wx.showToast({
            title: res.error || "操作失败",
            icon: "none"
          });
        }
      })
      .catch((err) => {
        console.error("保存智能体数据出现错误:", err);
        wx.showToast({ title: err.message || "接口操作异常", icon: "none" });
      })
      .finally(() => {
        this.setData({ saving: false });
      });
  },

  // 下线删除智能体
  onDeleteAgent: function (e) {
    const agentId = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: "确认删除智能体？",
      content: `下线智能体 [${name}] 后，未来部署协同工作流时将无法选用它。已运行的历史任务不受影响。`,
      cancelText: "取消",
      confirmText: "下线删除",
      confirmColor: "#ff3b30",
      success: (modalRes) => {
        if (modalRes.confirm) {
          request({
            url: `/api/v1/agents/delete?agentId=${agentId}`,
            method: "DELETE"
          })
            .then((res) => {
              if (res.success) {
                wx.showToast({ title: "智能体已下线", icon: "success" });
                this.loadData();
              } else {
                wx.showToast({ title: res.error || "下线失败", icon: "none" });
              }
            })
            .catch((err) => {
              console.error("删除智能体时异常:", err);
              wx.showToast({ title: "下线失败", icon: "none" });
            });
        }
      }
    });
  },
  onEditAgent: function (e) { this.onOpenEditModal(e); },
  onSaveAgent: function (e) { this.handleSave(e); }
});