const { request } = require("../../utils/request.js");

Page({
  data: {
    theme: 'dark',
    workflowName: '',
    goal: '',
    email: '',
    maxLoops: 5,
    availableAgents: [],
    selectedAgentIdsMap: {}, // id -> boolean
    userCredits: 100,
    isCreditsEnough: true,
    deploying: false,
    showAgentModal: false,
    savingAgent: false,
    agentForm: {
      name: '',
      avatar: '',
      role: '',
      systemPrompt: '',
      model: 'llama3.2',
      tools: []
    },
    agentFormToolsMap: {} // tool -> boolean
  },

  onShow: function () {
    const app = getApp();
    const currentTheme = app.globalData.theme;
    app.applyTheme(currentTheme);

    this.setData({
      theme: currentTheme === 'light' ? 'theme-light' : '',
      userCredits: app.globalData.userCredits,
      isCreditsEnough: app.globalData.userCredits >= 5
    });

    this.loadAgents();
  },

  onPullDownRefresh: function () {
    this.loadAgents().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadAgents: async function () {
    try {
      const res = await request({ url: "/api/v1/agents/list" });
      if (res.success && res.data) {
        const selectedAgentIdsMap = {};
        const validatedAgents = res.data.map(a => {
          selectedAgentIdsMap[a.id] = true;
          return {
            ...a,
            avatar: this.validateAvatar(a.avatar)
          };
        });

        this.setData({
          availableAgents: validatedAgents,
          selectedAgentIdsMap: selectedAgentIdsMap
        });
      }
    } catch (err) {
      console.error("加载智能体失败:", err);
    }
  },

  onWorkflowNameInput: function (e) { this.setData({ workflowName: e.detail.value }); },
  onGoalInput: function (e) { this.setData({ goal: e.detail.value }); },
  onEmailInput: function (e) { this.setData({ email: e.detail.value }); },

  toggleAgent: function (e) {
    const agentId = e.currentTarget.dataset.id;
    const selectedAgentIdsMap = { ...this.data.selectedAgentIdsMap };
    selectedAgentIdsMap[agentId] = !selectedAgentIdsMap[agentId];
    this.setData({ selectedAgentIdsMap });
  },

  onLoopsChange: function (e) {
    this.setData({
      maxLoops: e.detail.value
    });
  },

  openAgentModal: function () {
    this.setData({
      showAgentModal: true,
      agentForm: {
        name: '',
        avatar: '',
        role: '',
        systemPrompt: '',
        model: 'llama3.2',
        tools: []
      },
      agentFormToolsMap: {}
    });
  },

  closeAgentModal: function () {
    this.setData({ showAgentModal: false });
  },

  onPopupVisibleChange: function (e) {
    this.setData({ showAgentModal: e.detail.visible });
  },

  onAgentNameInput: function (e) { this.setData({ "agentForm.name": e.detail.value }); },
  onAgentAvatarInput: function (e) { this.setData({ "agentForm.avatar": e.detail.value }); },
  onAgentRoleInput: function (e) { this.setData({ "agentForm.role": e.detail.value }); },
  onAgentSystemPromptInput: function (e) { this.setData({ "agentForm.systemPrompt": e.detail.value }); },

  selectAgentModel: function (e) {
    this.setData({
      "agentForm.model": e.currentTarget.dataset.model
    });
  },

  toggleAgentTool: function (e) {
    const tool = e.currentTarget.dataset.tool;
    const agentFormToolsMap = { ...this.data.agentFormToolsMap };
    agentFormToolsMap[tool] = !agentFormToolsMap[tool];
    this.setData({ agentFormToolsMap });
  },

  saveCustomAgent: async function () {
    const f = this.data.agentForm;
    if (!f.name.trim()) {
      wx.showToast({ title: "请输入名称", icon: "none" });
      return;
    }
    if (!f.role.trim()) {
      wx.showToast({ title: "请输入职责描述", icon: "none" });
      return;
    }
    if (!f.systemPrompt.trim()) {
      wx.showToast({ title: "请输入系统指令", icon: "none" });
      return;
    }

    const tools = [];
    Object.keys(this.data.agentFormToolsMap).forEach(k => {
      if (this.data.agentFormToolsMap[k]) tools.push(k);
    });

    this.setData({ savingAgent: true });
    try {
      const res = await request({
        url: "/api/v1/agents/create",
        method: "POST",
        data: {
          name: f.name.trim(),
          avatar: f.avatar.trim() || "",
          role: f.role.trim(),
          systemPrompt: f.systemPrompt.trim(),
          model: f.model,
          tools: tools
        }
      });

      if (res.success && res.data) {
        wx.showToast({ title: "创建成功", icon: "success" });
        this.closeAgentModal();
        await this.loadAgents();
      } else {
        wx.showToast({ title: res.error || "创建失败", icon: "none" });
      }
    } catch (err) {
      console.error("创造智能体失败:", err);
    } finally {
      this.setData({ savingAgent: false });
    }
  },

  validateAvatar: function (avatar) {
    if (!avatar) return "service";
    const EMOJI_REGEX = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2b50]/;
    if (EMOJI_REGEX.test(avatar)) {
      return "service";
    }
    return avatar;
  },

  isValidEmail: function (email) {
    if (!email) return true;
    const reg = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/;
    return reg.test(email);
  },

  handleDeploy: async function () {
    if (this.data.deploying) return;

    if (!this.data.isCreditsEnough) {
      wx.showModal({
        title: "算力余额不足",
        content: "部署此任务需消耗 5 算力，当前额度不足。请前往算力账户进行激励补给。",
        confirmText: "我知道了",
        showCancel: false
      });
      return;
    }

    if (!this.data.goal.trim()) {
      wx.showToast({ title: "请输入目标", icon: "none" });
      return;
    }
    const selectedIds = Object.keys(this.data.selectedAgentIdsMap).filter(k => this.data.selectedAgentIdsMap[k]);
    if (selectedIds.length === 0) {
      wx.showToast({ title: "请配置智能体", icon: "none" });
      return;
    }

    if (this.data.email && !this.data.isValidEmail(this.data.email)) {
      wx.showToast({ title: "邮箱格式不正确", icon: "none" });
      return;
    }

    this.setData({ deploying: true });
    try {
      const payload = {
        email: this.data.email.trim(),
        workflowName: this.data.workflowName.trim() || "探索智能协同体流",
        goal: this.data.goal.trim(),
        agents: selectedIds.map(id => ({ agentId: id })),
        maxLoops: this.data.maxLoops
      };

      const res = await request({
        url: "/api/v1/tasks/create",
        method: "POST",
        data: {
          taskType: "AGENT_ORCHESTRATION",
          payload
        }
      });

      if (res.success && res.data) {
        wx.showToast({ title: "部署成功", icon: "success", duration: 1500 });

        // 扣除体力
        const app = getApp();
        app.globalData.userCredits -= 5;

        this.setData({
          workflowName: "",
          goal: "",
          email: ""
        });

        // 延迟跳转
        const taskId = res.data.taskId;
        setTimeout(() => {
          wx.navigateTo({ url: `/packageTask/detail/index?taskId=${taskId}` });
        }, 1200);
      } else {
        wx.showToast({ title: res.error || "部署失败", icon: "none" });
      }
    } catch (err) {
      console.error("部署任务异常:", err);
      wx.showToast({ title: "服务请求异常", icon: "none" });
    } finally {
      this.setData({ deploying: false });
    }
  },
  onShareAppMessage: function () {
    return {
      title: "Swarm 智能体任务管理系统",
      path: "/pages/deploy/index"
    };
  },


});
