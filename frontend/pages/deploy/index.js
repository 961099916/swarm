const { request } = require("../../utils/request.js");
const { lightTap } = require("../../utils/feedback.js");
const { TOAST_DURATION_MS, ROUTES, API } = require("../../utils/constants.js");
const { validateAvatar } = require("../../utils/avatar.js");

Page({
  data: {
    theme: 'dark',
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

    this.loadAgents();
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

    // ---- 表单校验 ----
    const fieldErrors = {};
    const selectedIds = Object.keys(this.data.selectedAgentIdsMap)
      .filter(k => this.data.selectedAgentIdsMap[k]);

    if (!this.data.goal.trim()) fieldErrors.goal = '请输入任务目标';
    if (selectedIds.length === 0) fieldErrors.agents = '请至少选择一个智能体';
    if (this.data.email && !this._isValidEmail(this.data.email)) {
      fieldErrors.email = '邮箱格式不正确';
    }

    if (Object.keys(fieldErrors).length > 0) {
      this.setData({ fieldErrors });
      wx.showToast({ title: Object.values(fieldErrors)[0], icon: 'none', duration: TOAST_DURATION_MS });
      setTimeout(() => this.setData({ fieldErrors: {} }), TOAST_DURATION_MS);
      return;
    }

    // ---- 提交 ----
    this.setData({ fieldErrors: {}, deploying: true });
    try {
      const res = await request({
        url: '/api/v1/tasks/create',
        method: 'POST',
        data: {
          taskType: 'AGENT_ORCHESTRATION',
          payload: {
            email: this.data.email.trim(),
            workflowName: this.data.workflowName.trim() || '探索智能协同体流',
            goal: this.data.goal.trim(),
            agents: selectedIds.map(id => ({ agentId: id })),
            maxLoops: this.data.maxLoops,
          },
        },
      });

      if (res.success && res.data) {
        wx.showToast({ title: '部署成功', icon: 'success', duration: 1500 });
        const app = getApp();
        app.globalData.userCredits -= 5;
        this.setData({ workflowName: '', goal: '', email: '' });
        // 清除已选持久化
        try {
          wx.removeStorageSync('deploy_selected_agents');
        } catch (_e) { /* 静默 */ }
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
});
