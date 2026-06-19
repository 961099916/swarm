const { listKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase } = require("../../utils/knowledgeAPI.js");
const listPage = require("../../utils/listPage.js");

const kbListBehavior = listPage.create({
  pageSize: 20,
  async fetchData(params) {
    const { page, pageSize, searchQuery } = params;
    return { data: await listKnowledgeBases(page, pageSize, searchQuery) };
  },
  parseList(res) {
    return res.data?.list || [];
  },
  parseTotal(res) {
    return res.data?.total || 0;
  },
  listKey: 'kbList',
});

Page({
  ...kbListBehavior,

  data: {
    ...kbListBehavior.data,
    currentTab: 'knowledge',
    showCreateDialog: false,
    newKBName: "",
    newKBDesc: "",
  },

  onLoad() {
    this.loadFirstPage();
  },

  onShow() {
    this.loadFirstPage();
  },

  // ── 搜索（统一搜索栏风格）──
  onSearch(e) {
    const value = (e.detail.value || "").trim();
    this.setData({ searchQuery: value, page: 1, hasMore: true });
    this.loadFirstPage();
  },

  onSearchClear() {
    this.setData({ searchQuery: "", page: 1, hasMore: true });
    this.loadFirstPage();
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
      await createKnowledgeBase(this.data.newKBName.trim(), this.data.newKBDesc.trim() || undefined);
      wx.showToast({ title: "创建成功", icon: "success" });
      this.setData({ showCreateDialog: false });
      this.loadFirstPage();
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
          if (res.success) { wx.showToast({ title: "已删除", icon: "success" }); this.loadFirstPage(); }
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
