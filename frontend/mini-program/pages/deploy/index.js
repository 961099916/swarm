const { request } = require("../../utils/request.js");
const { listAgents } = require("../../utils/agentAPI.js");
const { createTask } = require("../../utils/taskAPI.js");
const { lightTap } = require("../../utils/feedback.js");
const { TOAST_DURATION_MS, ROUTES, API } = require("../../utils/constants.js");
const { validateAvatar } = require("../../utils/avatar.js");

Page({
  data: {
    theme: 'dark',
    activeTab: 0,
    showFlowPreview: false,
    workflowName: '',
    goal: '',
    email: '',
    maxLoops: 5,
    /** @type {Array<{id:string,name:string,role:string,avatar:string,isPreset:boolean}>} */
    availableAgents: [],
    loadingAgents: false,
    /** @type {Object<string,boolean>} */
    selectedAgentIdsMap: {},
    userCredits: 100,
    isCreditsEnough: true,
    deploying: false,
    showAgentModal: false,
    showAgentPicker: false,
    agentSearchQuery: '',
    /** @type {Array<{id:string,name:string,role:string,avatar:string,isPreset:boolean}>} */
    filteredAgents: [],
    selectedAgentCount: 0,
    /** @type {Array<{id:string,name:string}>} */
    selectedAgentPreview: [],
    savingAgent: false,
    /** @type {Object<string,string>} */
    fieldErrors: {},

    // ─── 自定义编排器辅助定义 ───
    stepsList: [],
    stepTypeOptions: [
      { label: '智能体', value: 'agent' },
      { label: '系统工具', value: 'tool' },
      { label: '条件分类', value: 'condition' }
    ],
    toolOptions: [
      { label: '网页搜索 (SEARCH)', value: 'SEARCH' },
      { label: '邮件通知 (EMAIL)', value: 'EMAIL' }
    ],

    /** t-skeleton 骨架屏配置 */
    skeletonConfig: [
      { width: '72rpx', height: '72rpx', type: 'circle' },
      { width: 'calc(100% - 100rpx)' },
      { width: '40%' },
    ],
  },

  /** 内存缓存：避免短时间内重复请求 */
  _agentCache: null,
  /** 缓存有效期（毫秒） */
  _CACHE_TTL_MS: 30000,
  /** 搜索防抖定时器 */
  _searchDebounceTimer: null,

  onShow() {
    const app = getApp();
    const currentTheme = app.globalData.theme;
    app.applyTheme(currentTheme);

    this.setData({
      theme: currentTheme === 'light' ? 'theme-light' : '',
      userCredits: app.globalData.userCredits,
      isCreditsEnough: app.globalData.userCredits >= 5,
    });

    this.loadAgents().then(() => {
      if (!this.data.stepsList || this.data.stepsList.length === 0) {
        this.setData({
          stepsList: [
            {
              id: "step_1",
              name: "首个节点",
              type: "agent",
              targetId: "",
              targetAgentName: "",
              prompt: "",
              nextStepId: "",
              nextStepName: "结束流程",
              nextOptions: []
            }
          ]
        }, () => {
          this.updateStepNextOptions();
        });
      }
    });
  },

  onPullDownRefresh() {
    // 下拉刷新时清除缓存，强制重新加载
    this._agentCache = null;
    this.loadAgents().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载智能体列表（带内存缓存，30s 内不重复请求）
   * @returns {Promise<void>}
   */
  async loadAgents() {
    // 缓存命中且未过期，直接返回
    if (this._agentCache && Date.now() - this._agentCache.ts < this._CACHE_TTL_MS) {
      this.setData({
        availableAgents: this._agentCache.data,
        loadingAgents: false,
      });
      this._applyCacheSelection();
      return;
    }

    this.setData({ loadingAgents: true });
    try {
      const res = await request({ url: API.AGENTS_LIST });
      if (res.success && res.data) {
        const validatedAgents = res.data.map(a => ({
          ...a,
          avatar: validateAvatar(a.avatar),
        }));

        // 写缓存
        this._agentCache = { ts: Date.now(), data: validatedAgents };

        this.setData({
          availableAgents: validatedAgents,
          loadingAgents: false,
        });
        this._applyCacheSelection();
      } else {
        this.setData({ loadingAgents: false });
      }
    } catch (err) {
      console.error('[Deploy] 加载智能体失败:', err);
      this.setData({ loadingAgents: false });
      wx.showToast({ title: '加载智能体失败，请下拉重试', icon: 'none', duration: TOAST_DURATION_MS });
    }
  },

  /**
   * 恢复上次勾选状态（从 storage 读取）
   */
  _applyCacheSelection() {
    try {
      const saved = wx.getStorageSync('deploy_selected_agents');
      if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
        this.setData({ selectedAgentIdsMap: saved });
        this._updateSelectedPreview();
      }
    } catch (_e) {
      // storage 读取失败静默降级
    }
  },

  onWorkflowNameInput(e) {
    this.setData({ workflowName: e.detail.value });
  },

  onGoalInput(e) {
    this.setData({ goal: e.detail.value });
  },

  onEmailInput(e) {
    this.setData({ email: e.detail.value });
  },

  /**
   * 切换智能体选中状态
   * @param {WechatMiniprogram.BaseEvent} e
   */
  toggleAgent(e) {
    lightTap();
    const agentId = e.currentTarget.dataset.id;
    const selectedAgentIdsMap = { ...this.data.selectedAgentIdsMap };
    selectedAgentIdsMap[agentId] = !selectedAgentIdsMap[agentId];
    this.setData({ selectedAgentIdsMap });
    this._updateSelectedPreview();
    // 持久化勾选状态
    try {
      wx.setStorageSync('deploy_selected_agents', selectedAgentIdsMap);
    } catch (_e) {
      // 静默降级
    }
  },

  onLoopsChange(e) {
    this.setData({ maxLoops: e.detail.value });
  },

  openAgentModal() {
    lightTap();
    wx.navigateTo({ url: ROUTES.AGENT_MANAGER });
  },



  /**
   * 校验邮箱格式（RFC 5322 简化版）
   * @param {string} email - 邮箱地址
   * @returns {boolean}
   */
  _isValidEmail(email) {
    if (!email) return true;
    return /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(email);
  },

  /**
   * 提交部署任务
   * @returns {Promise<void>}
   */
  async handleDeploy() {
    lightTap();
    if (this.data.deploying) return;
    if (!this.data.isCreditsEnough) {
      wx.showModal({
        title: '算力余额不足',
        content: '部署此任务需消耗 5 算力，当前额度不足。请前往算力账户进行激励补给。',
        confirmText: '我知道了',
        showCancel: false,
      });
      return;
    }

    const { activeTab, goal, workflowName, email, stepsList, selectedAgentIdsMap } = this.data;
    const fieldErrors = {};

    if (!goal.trim()) {
      fieldErrors.goal = activeTab === 0 ? '请输入任务目标' : '请输入全局初始输入';
    }
    if (email && !this._isValidEmail(email)) {
      fieldErrors.email = '邮箱格式不正确';
    }

    let taskType = 'AGENT_ORCHESTRATION';
    let payload = {};

    if (activeTab === 0) {
      const selectedIds = Object.keys(selectedAgentIdsMap).filter(k => selectedAgentIdsMap[k]);
      if (selectedIds.length === 0) fieldErrors.agents = '请至少选择一个智能体';
      
      if (Object.keys(fieldErrors).length > 0) {
        this.setData({ fieldErrors });
        wx.showToast({ title: Object.values(fieldErrors)[0], icon: 'none', duration: TOAST_DURATION_MS });
        setTimeout(() => this.setData({ fieldErrors: {} }), TOAST_DURATION_MS);
        return;
      }

      payload = {
        email: email.trim(),
        workflowName: workflowName.trim() || '探索智能协同体流',
        goal: goal.trim(),
        agents: selectedIds.map(id => ({ agentId: id })),
        maxLoops: this.data.maxLoops,
      };
    } else {
      if (!stepsList || stepsList.length === 0) {
        wx.showToast({ title: '请至少添加一个步骤节点', icon: 'none', duration: TOAST_DURATION_MS });
        return;
      }
      
      for (let i = 0; i < stepsList.length; i++) {
        const s = stepsList[i];
        if (!s.name.trim()) {
          wx.showToast({ title: `步骤 ${i + 1} 名字不能为空`, icon: 'none', duration: TOAST_DURATION_MS });
          return;
        }
        if (s.type !== 'condition' && !s.targetId) {
          wx.showToast({ title: `请配置步骤 ${i + 1} 的执行目标`, icon: 'none', duration: TOAST_DURATION_MS });
          return;
        }
        if (s.type === 'condition') {
          if (!s.branches || s.branches.length === 0) {
            wx.showToast({ title: `步骤 ${i + 1} 请至少配置一个分支匹配条件`, icon: 'none', duration: TOAST_DURATION_MS });
            return;
          }
          for (let bIdx = 0; bIdx < s.branches.length; bIdx++) {
            const b = s.branches[bIdx];
            if (!b.label.trim() || !b.matchValue.trim()) {
              wx.showToast({ title: `步骤 ${i + 1} 分支 ${bIdx + 1} 的名称或匹配词不能为空`, icon: 'none', duration: TOAST_DURATION_MS });
              return;
            }
          }
        }
      }

      if (Object.keys(fieldErrors).length > 0) {
        this.setData({ fieldErrors });
        wx.showToast({ title: Object.values(fieldErrors)[0], icon: 'none', duration: TOAST_DURATION_MS });
        setTimeout(() => this.setData({ fieldErrors: {} }), TOAST_DURATION_MS);
        return;
      }

      const stepsMap = {};
      stepsList.forEach(s => {
        const node = {
          id: s.id,
          name: s.name,
          type: s.type,
          targetId: s.targetId,
          prompt: s.prompt
        };
        if (s.type === 'condition') {
          node.branches = (s.branches || []).map(b => ({
            label: b.label,
            matchValue: b.matchValue,
            nextStepId: b.nextStepId || ""
          }));
          node.defaultNextStepId = s.defaultNextStepId || "";
        } else {
          node.nextStepId = s.nextStepId || "";
        }
        stepsMap[s.id] = node;
      });

      taskType = 'WORKFLOW_EXECUTION';
      payload = {
        email: email.trim(),
        workflowName: workflowName.trim() || '自定义静态分支工作流',
        goal: goal.trim(),
        firstStepId: stepsList[0].id,
        steps: stepsMap
      };
    }

    this.setData({ fieldErrors: {}, deploying: true });
    try {
      const res = await request({
        url: '/api/v1/tasks/create',
        method: 'POST',
        data: {
          taskType,
          payload,
        },
      });

      if (res.success && res.data) {
        wx.showToast({ title: '部署成功', icon: 'success', duration: 1500 });
        const app = getApp();
        app.globalData.userCredits -= 5;
        this.setData({ workflowName: '', goal: '', email: '' });
        if (activeTab === 0) {
          try { wx.removeStorageSync('deploy_selected_agents'); } catch (_) {}
        }
        setTimeout(
          () => wx.navigateTo({ url: `/packageTask/detail/index?taskId=${res.data.taskId}` }),
          1200,
        );
      } else {
        wx.showToast({ title: res.error || '部署失败', icon: 'none', duration: TOAST_DURATION_MS });
      }
    } catch (err) {
      console.error('[Deploy] 部署任务异常:', err);
      wx.showToast({ title: '服务请求异常', icon: 'none', duration: TOAST_DURATION_MS });
    } finally {
      this.setData({ deploying: false });
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.value });
  },

  // ─── 自定义编排器逻辑函数 ───
  updateStepNextOptions() {
    const list = this.data.stepsList || [];
    const updated = list.map((step, idx) => {
      const otherSteps = list
        .filter(s => s.id !== step.id)
        .map(s => ({
          label: s.name || '未命名步骤',
          value: s.id
        }));
      
      const nextOptions = [
        ...otherSteps,
        { label: "结束流程", value: "" }
      ];

      let nextStepId = step.nextStepId || "";
      if (nextStepId && !list.some(s => s.id === nextStepId)) {
        nextStepId = "";
      }
      
      const matchedNext = nextOptions.find(o => o.value === nextStepId);
      const nextStepName = matchedNext ? matchedNext.label : "结束流程";

      let branches = step.branches || [];
      branches = branches.map(b => {
        let bNextId = b.nextStepId || "";
        if (bNextId && !list.some(s => s.id === bNextId)) {
          bNextId = "";
        }
        const bMatched = nextOptions.find(o => o.value === bNextId);
        return {
          ...b,
          nextStepId: bNextId,
          targetStepName: bMatched ? bMatched.label : "结束流程"
        };
      });

      let defaultNextStepId = step.defaultNextStepId || "";
      if (defaultNextStepId && !list.some(s => s.id === defaultNextStepId)) {
        defaultNextStepId = "";
      }
      const defaultMatched = nextOptions.find(o => o.value === defaultNextStepId);
      const defaultNextStepName = defaultMatched ? defaultMatched.label : "结束流程";

      return {
        ...step,
        nextOptions,
        nextStepId,
        nextStepName,
        branches,
        defaultNextStepId,
        defaultNextStepName
      };
    });

    this.setData({ stepsList: updated });
  },

  onStepNameInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const value = e.detail.value;
    const stepsList = [...this.data.stepsList];
    if (stepsList[idx]) {
      stepsList[idx].name = value;
      this.setData({ stepsList }, () => {
        this.updateStepNextOptions();
      });
    }
  },

  onStepTypeChange(e) {
    const idx = e.currentTarget.dataset.idx;
    const valIdx = e.detail.value;
    const selectedType = this.data.stepTypeOptions[valIdx].value;
    const stepsList = [...this.data.stepsList];
    if (stepsList[idx]) {
      stepsList[idx].type = selectedType;
      stepsList[idx].targetId = "";
      stepsList[idx].targetAgentName = "";
      stepsList[idx].targetToolLabel = "";
      if (selectedType === "condition" && (!stepsList[idx].branches || stepsList[idx].branches.length === 0)) {
        stepsList[idx].branches = [
          { label: "分支一", matchValue: "yes", nextStepId: "", targetStepName: "结束流程" }
        ];
        stepsList[idx].defaultNextStepId = "";
        stepsList[idx].defaultNextStepName = "结束流程";
      }
      this.setData({ stepsList }, () => {
        this.updateStepNextOptions();
      });
    }
  },

  onStepAgentChange(e) {
    const idx = e.currentTarget.dataset.idx;
    const valIdx = e.detail.value;
    const agent = this.data.availableAgents[valIdx];
    const stepsList = [...this.data.stepsList];
    if (stepsList[idx] && agent) {
      stepsList[idx].targetId = agent.id;
      stepsList[idx].targetAgentName = agent.name;
      this.setData({ stepsList });
    }
  },

  onStepToolChange(e) {
    const idx = e.currentTarget.dataset.idx;
    const valIdx = e.detail.value;
    const tool = this.data.toolOptions[valIdx];
    const stepsList = [...this.data.stepsList];
    if (stepsList[idx] && tool) {
      stepsList[idx].targetId = tool.value;
      stepsList[idx].targetToolLabel = tool.label;
      this.setData({ stepsList });
    }
  },

  onStepPromptInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const value = e.detail.value;
    const stepsList = [...this.data.stepsList];
    if (stepsList[idx]) {
      stepsList[idx].prompt = value;
      this.setData({ stepsList });
    }
  },

  onStepNextChange(e) {
    const idx = e.currentTarget.dataset.idx;
    const optIdx = e.detail.value;
    const stepsList = [...this.data.stepsList];
    const step = stepsList[idx];
    if (step && step.nextOptions && step.nextOptions[optIdx]) {
      step.nextStepId = step.nextOptions[optIdx].value;
      step.nextStepName = step.nextOptions[optIdx].label;
      this.setData({ stepsList });
    }
  },

  onStepDefaultNextChange(e) {
    const idx = e.currentTarget.dataset.idx;
    const optIdx = e.detail.value;
    const stepsList = [...this.data.stepsList];
    const step = stepsList[idx];
    if (step && step.nextOptions && step.nextOptions[optIdx]) {
      step.defaultNextStepId = step.nextOptions[optIdx].value;
      step.defaultNextStepName = step.nextOptions[optIdx].label;
      this.setData({ stepsList });
    }
  },

  onBranchLabelInput(e) {
    const { sidx, bidx } = e.currentTarget.dataset;
    const value = e.detail.value;
    const stepsList = [...this.data.stepsList];
    if (stepsList[sidx] && stepsList[sidx].branches[bidx]) {
      stepsList[sidx].branches[bidx].label = value;
      this.setData({ stepsList });
    }
  },

  onBranchValueInput(e) {
    const { sidx, bidx } = e.currentTarget.dataset;
    const value = e.detail.value;
    const stepsList = [...this.data.stepsList];
    if (stepsList[sidx] && stepsList[sidx].branches[bidx]) {
      stepsList[sidx].branches[bidx].matchValue = value;
      this.setData({ stepsList });
    }
  },

  onBranchNextChange(e) {
    const { sidx, bidx } = e.currentTarget.dataset;
    const optIdx = e.detail.value;
    const stepsList = [...this.data.stepsList];
    const step = stepsList[sidx];
    if (step && step.branches[bidx] && step.nextOptions && step.nextOptions[optIdx]) {
      step.branches[bidx].nextStepId = step.nextOptions[optIdx].value;
      step.branches[bidx].targetStepName = step.nextOptions[optIdx].label;
      this.setData({ stepsList });
    }
  },

  addBranch(e) {
    const idx = e.currentTarget.dataset.idx;
    const stepsList = [...this.data.stepsList];
    if (stepsList[idx]) {
      if (!stepsList[idx].branches) stepsList[idx].branches = [];
      stepsList[idx].branches.push({
        label: `分支${stepsList[idx].branches.length + 1}`,
        matchValue: `value${stepsList[idx].branches.length + 1}`,
        nextStepId: "",
        targetStepName: "结束流程"
      });
      this.setData({ stepsList }, () => {
        this.updateStepNextOptions();
      });
    }
  },

  deleteBranch(e) {
    const { sidx, bidx } = e.currentTarget.dataset;
    const stepsList = [...this.data.stepsList];
    if (stepsList[sidx]) {
      stepsList[sidx].branches.splice(bidx, 1);
      this.setData({ stepsList }, () => {
        this.updateStepNextOptions();
      });
    }
  },

  moveStepUp(e) {
    const idx = e.currentTarget.dataset.idx;
    if (idx === 0) return;
    const stepsList = [...this.data.stepsList];
    const temp = stepsList[idx];
    stepsList[idx] = stepsList[idx - 1];
    stepsList[idx - 1] = temp;
    this.setData({ stepsList }, () => {
      this.updateStepNextOptions();
    });
  },

  moveStepDown(e) {
    const idx = e.currentTarget.dataset.idx;
    if (idx === this.data.stepsList.length - 1) return;
    const stepsList = [...this.data.stepsList];
    const temp = stepsList[idx];
    stepsList[idx] = stepsList[idx + 1];
    stepsList[idx + 1] = temp;
    this.setData({ stepsList }, () => {
      this.updateStepNextOptions();
    });
  },

  deleteStep(e) {
    const idx = e.currentTarget.dataset.idx;
    const stepsList = [...this.data.stepsList];
    stepsList.splice(idx, 1);
    this.setData({ stepsList }, () => {
      this.updateStepNextOptions();
    });
  },

  addNewStep() {
    const stepsList = [...this.data.stepsList];
    const newIdx = stepsList.length + 1;
    stepsList.push({
      id: "step_" + Date.now(),
      name: `步骤 ${newIdx}`,
      type: "agent",
      targetId: "",
      targetAgentName: "",
      prompt: "",
      nextStepId: "",
      nextStepName: "结束流程",
      nextOptions: []
    });
    this.setData({ stepsList }, () => {
      this.updateStepNextOptions();
    });
  },

  onShareAppMessage() {
    return {
      title: 'Swarm 智能体任务管理系统',
      path: '/pages/deploy/index',
    };
  },

  // ─── 智能体选择器 ───

  openAgentPicker() {
    this.setData({
      showAgentPicker: true,
      agentSearchQuery: '',
      filteredAgents: this.data.availableAgents,
    });
  },

  closeAgentPicker() {
    this.setData({ showAgentPicker: false });
  },

  /**
   * popup 可见性变化回调
   * @param {WechatMiniprogram.BaseEvent} e
   */
  onPickerVisibleChange(e) {
    if (!e.detail.visible) {
      this.setData({ showAgentPicker: false });
    }
  },

  /**
   * 搜索输入回调（带防抖）
   * @param {WechatMiniprogram.InputEvent} e
   */
  onAgentSearchInput(e) {
    const query = e.detail.value;
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this._doFilter(query);
    }, 200);
  },

  /** 搜索栏清空 */
  onAgentSearchClear() {
    this.setData({ agentSearchQuery: '', filteredAgents: this.data.availableAgents });
  },

  /**
   * 实际执行过滤（与非受控搜索隔离，避免中间状态联动）
   * @param {string} rawQuery
   */
  _doFilter(rawQuery) {
    const query = (rawQuery || '').toLowerCase().trim();
    const list = this.data.availableAgents;
    if (!query) {
      this.setData({ agentSearchQuery: '', filteredAgents: list });
      return;
    }
    const filtered = list.filter(a =>
      (a.name && a.name.toLowerCase().includes(query))
      || (a.role && a.role.toLowerCase().includes(query)),
    );
    this.setData({ agentSearchQuery: rawQuery, filteredAgents: filtered });
  },

  confirmAgentPicker() {
    this._updateSelectedPreview();
    this.closeAgentPicker();
  },

  /** 更新已选预览（至多 5 个） */
  _updateSelectedPreview() {
    const selected = this.data.availableAgents.filter(
      a => this.data.selectedAgentIdsMap[a.id],
    );
    this.setData({
      selectedAgentCount: selected.length,
      selectedAgentPreview: selected.slice(0, 5),
    });
  },

  openFlowPreview() {
    this.setData({ showFlowPreview: true }, () => {
      setTimeout(() => {
        this.drawFlowChart();
      }, 150);
    });
  },

  closeFlowPreview() {
    this.setData({ showFlowPreview: false });
  },

  onFlowPreviewVisibleChange(e) {
    if (!e.detail.visible) {
      this.setData({ showFlowPreview: false });
    }
  },

  drawFlowChart() {
    const query = wx.createSelectorQuery();
    query.select('#flowCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        const width = res[0].width;
        const height = res[0].height;

        ctx.clearRect(0, 0, width, height);

        const list = this.data.stepsList || [];
        if (list.length === 0) return;

        const stepsMap = {};
        list.forEach(s => { stepsMap[s.id] = s; });

        const firstStepId = list[0].id;
        const levels = {};
        const visited = new Set();
        const queue = [{ id: firstStepId, lv: 0 }];

        while (queue.length > 0) {
          const curr = queue.shift();
          if (visited.has(curr.id)) continue;
          visited.add(curr.id);
          levels[curr.id] = Math.max(levels[curr.id] || 0, curr.lv);

          const stepObj = stepsMap[curr.id];
          if (stepObj) {
            if (stepObj.type === 'condition') {
              const branches = stepObj.branches || [];
              branches.forEach(b => {
                if (b.nextStepId && stepsMap[b.nextStepId]) {
                  queue.push({ id: b.nextStepId, lv: curr.lv + 1 });
                }
              });
              if (stepObj.defaultNextStepId && stepsMap[stepObj.defaultNextStepId]) {
                queue.push({ id: stepObj.defaultNextStepId, lv: curr.lv + 1 });
              }
            } else {
              if (stepObj.nextStepId && stepsMap[stepObj.nextStepId]) {
                queue.push({ id: stepObj.nextStepId, lv: curr.lv + 1 });
              }
            }
          }
        }

        let maxLv = 0;
        Object.keys(levels).forEach(id => {
          if (levels[id] > maxLv) maxLv = levels[id];
        });

        list.forEach(s => {
          if (levels[s.id] === undefined) {
            levels[s.id] = maxLv + 1;
          }
        });

        maxLv = 0;
        list.forEach(s => {
          if (levels[s.id] > maxLv) maxLv = levels[s.id];
        });

        const levelGroups = [];
        for (let i = 0; i <= maxLv; i++) {
          levelGroups.push([]);
        }
        list.forEach(s => {
          const lv = levels[s.id];
          levelGroups[lv].push(s.id);
        });

        const nodeCoords = {};
        const nodeW = 100;
        const nodeH = 34;
        const yGap = 72;
        const xGap = 110;
        const topPadding = 30;

        levelGroups.forEach((groupIds, lv) => {
          const count = groupIds.length;
          const y = topPadding + lv * yGap;
          groupIds.forEach((id, idx) => {
            const x = (width / 2) + (idx - (count - 1) / 2) * xGap - (nodeW / 2);
            nodeCoords[id] = { x, y, w: nodeW, h: nodeH };
          });
        });

        ctx.lineWidth = 1.5;
        list.forEach(step => {
          const fromCoord = nodeCoords[step.id];
          if (!fromCoord) return;

          const drawArrow = (fromX, fromY, toX, toY, color) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            
            const midY = (fromY + toY) / 2;
            ctx.moveTo(fromX, fromY);
            ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - 4, toY - 6);
            ctx.lineTo(toX + 4, toY - 6);
            ctx.closePath();
            ctx.fill();
          };

          const drawBubble = (txt, x, y, color) => {
            ctx.save();
            ctx.font = '8px Outfit, sans-serif';
            const textWidth = ctx.measureText(txt).width || 20;
            const bw = textWidth + 8;
            const bh = 14;
            const bx = x - bw / 2;
            const by = y - bh / 2;

            ctx.fillStyle = 'rgba(45, 42, 36, 0.9)';
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(bx + 3, by);
            ctx.lineTo(bx + bw - 3, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 3);
            ctx.lineTo(bx + bw, by + bh - 3);
            ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 3, by + bh);
            ctx.lineTo(bx + 3, by + bh);
            ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 3);
            ctx.lineTo(bx, by + 3);
            ctx.quadraticCurveTo(bx, by, bx + 3, by);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, x, y + 0.5);
            ctx.restore();
          };

          if (step.type === 'condition') {
            const branches = step.branches || [];
            branches.forEach(b => {
              if (b.nextStepId && nodeCoords[b.nextStepId]) {
                const toCoord = nodeCoords[b.nextStepId];
                const fromX = fromCoord.x + fromCoord.w / 2;
                const fromY = fromCoord.y + fromCoord.h;
                const toX = toCoord.x + toCoord.w / 2;
                const toY = toCoord.y;
                drawArrow(fromX, fromY, toX, toY, '#FF6B6B');
                
                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2;
                drawBubble(b.matchValue || b.label, midX, midY, '#FF6B6B');
              }
            });
            if (step.defaultNextStepId && nodeCoords[step.defaultNextStepId]) {
              const toCoord = nodeCoords[step.defaultNextStepId];
              const fromX = fromCoord.x + fromCoord.w / 2;
              const fromY = fromCoord.y + fromCoord.h;
              const toX = toCoord.x + toCoord.w / 2;
              const toY = toCoord.y;
              drawArrow(fromX, fromY, toX, toY, '#7A726A');
              
              const midX = (fromX + toX) / 2;
              const midY = (fromY + toY) / 2;
              drawBubble('default', midX, midY, '#7A726A');
            }
          } else {
            if (step.nextStepId && nodeCoords[step.nextStepId]) {
              const toCoord = nodeCoords[step.nextStepId];
              drawArrow(
                fromCoord.x + fromCoord.w / 2,
                fromCoord.y + fromCoord.h,
                toCoord.x + toCoord.w / 2,
                toCoord.y,
                '#FF6B6B'
              );
            }
          }
        });

        list.forEach((step, idx) => {
          const coord = nodeCoords[step.id];
          if (!coord) return;

          ctx.save();
          ctx.beginPath();
          const r = 6;
          const { x, y, w, h } = coord;
          
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();

          ctx.fillStyle = 'rgba(45, 42, 36, 0.95)';
          ctx.fill();

          ctx.lineWidth = 1;
          if (step.type === 'agent') {
            ctx.strokeStyle = '#4CAF50';
          } else if (step.type === 'tool') {
            ctx.strokeStyle = '#00BCD4';
          } else {
            ctx.strokeStyle = '#FF9800';
          }
          ctx.stroke();

          ctx.font = 'bold 9px Outfit, sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const indexLabel = `[${idx + 1}] `;
          const stepName = step.name || '步骤';
          const truncatedName = stepName.length > 7 ? stepName.slice(0, 6) + '..' : stepName;
          
          ctx.fillText(indexLabel + truncatedName, x + w / 2, y + h / 2);
          ctx.restore();
        });
      });
  },
});
