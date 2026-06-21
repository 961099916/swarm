const { request } = require("../../utils/request.js");

Page({
  data: {
    currentTab: 'knowledge',
    kbList: [],
    filteredList: [],
    loading: false,
    searchValue: "",
    stats: { total: 0, public: 0, private: 0 },
    showCreateDialog: false,
    newKBName: "",
    newKBDesc: "",
  },

  onLoad() {
    this.fetchKBList();
  },

  onShow() {
    this.fetchKBList();
  },

  async fetchKBList() {
    this.setData({ loading: true });
    try {
      const res = await request({ url: "/api/v1/kb/list" });
      if (res.success) {
        const list = res.data || [];
        const stats = {
          total: list.length,
          public: list.filter(k => k.isPublic).length,
          private: list.filter(k => !k.isPublic).length,
        };
        this.setData({ kbList: list, filteredList: list, stats, loading: false });
      }
    } catch (err) {
      console.error("获取知识库列表失败", err);
      this.setData({ loading: false });
    }
  },

  onSearch(e) {
    const keyword = (e.detail.value || "").toLowerCase().trim();
    this.setData({ searchValue: keyword });
    if (!keyword) { this.setData({ filteredList: this.data.kbList }); return; }
    const filtered = this.data.kbList.filter(k =>
      k.name.toLowerCase().includes(keyword) ||
      (k.description && k.description.toLowerCase().includes(keyword))
    );
    this.setData({ filteredList: filtered });
  },

  // ── 创建知识库 ──
  showCreate() { this.setData({ showCreateDialog: true, newKBName: "", newKBDesc: "" }); },
  onCreateCancel() { this.setData({ showCreateDialog: false }); },
  onNameInput(e) { this.setData({ newKBName: e.detail.value }); },
  onDescInput(e) { this.setData({ newKBDesc: e.detail.value }); },

  async onCreateKB() {
    if (!this.data.newKBName.trim()) {
      wx.showToast({ title: "请输入名称", icon: "none" }); return;
    }
    try {
      const res = await request({
        url: "/api/v1/kb/create", method: "POST",
        data: { name: this.data.newKBName.trim(), description: this.data.newKBDesc.trim() || undefined },
      });
      if (res.success) {
        wx.showToast({ title: "创建成功", icon: "success" });
        this.setData({ showCreateDialog: false });
        this.fetchKBList();
      } else {
        wx.showToast({ title: res.error || "创建失败", icon: "none" });
      }
    } catch (err) { wx.showToast({ title: "创建失败", icon: "none" }); }
  },

  // ── 删除知识库 ──
  onDeleteKB(e) {
    const kb = e.currentTarget.dataset.kb;
    wx.showModal({
      title: "确认删除",
      content: `确定删除「${kb.name}」？文档将一并清除。`,
      success: async (r) => {
        if (r.confirm) {
          const res = await request({ url: `/api/v1/kb/delete?kbId=${kb.id}`, method: "DELETE" });
          if (res.success) { wx.showToast({ title: "已删除", icon: "success" }); this.fetchKBList(); }
          else { wx.showToast({ title: res.error || "删除失败", icon: "none" }); }
        }
      },
    });
  },

  // ── 跳转 ──
  goToChat(e) {
    const kb = e.currentTarget.dataset.kb;
    wx.navigateTo({
      url: `/packageKnowledge/chat/index?kbId=${kb.id}&kbName=${encodeURIComponent(kb.name)}`
    });
  },

  goToDetail(e) {
    const kb = e.currentTarget.dataset.kb;
    wx.navigateTo({
      url: `/packageKnowledge/detail/index?kbId=${kb.id}&kbName=${encodeURIComponent(kb.name)}`
    });
  },
});
