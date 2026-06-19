const { request } = require("../../utils/request.js");

Page({
  data: {
    kbId: "",
    kbName: "",
    kbInfo: null,
    documents: [],
    loading: false,
  },

  onLoad(options) {
    if (options.kbId) {
      this.setData({
        kbId: options.kbId,
        kbName: decodeURIComponent(options.kbName || "知识库"),
      });
      wx.setNavigationBarTitle({ title: this.data.kbName });
      this.loadKBInfo();
      this.loadDocuments();
    }
  },

  async loadKBInfo() {
    try {
      const res = await request({ url: `/api/v1/kb/get?kbId=${this.data.kbId}` });
      if (res.success) this.setData({ kbInfo: res.data });
    } catch (err) {
      console.error("获取知识库信息失败", err);
    }
  },

  async loadDocuments() {
    this.setData({ loading: true });
    try {
      const res = await request({ url: `/api/v1/kb/document/list?kbId=${this.data.kbId}` });
      if (res.success) this.setData({ documents: res.data || [], loading: false });
    } catch (err) {
      console.error("获取文档列表失败", err);
      this.setData({ loading: false });
    }
  },

  // ── 删除文档 ──
  onDeleteDoc(e) {
    const doc = e.currentTarget.dataset.doc;
    wx.showModal({
      title: "确认删除", content: `删除「${doc.title}」？`,
      success: async (r) => {
        if (r.confirm) {
          const res = await request({ url: `/api/v1/kb/document/delete?docId=${doc.id}`, method: "DELETE" });
          if (res.success) { wx.showToast({ title: "已删除", icon: "success" }); this.loadDocuments(); }
        }
      },
    });
  },

  // ── 跳转到添加页 ──
  goToAdd() {
    wx.navigateTo({ url: `/packageKnowledge/add/index?kbId=${this.data.kbId}&kbName=${encodeURIComponent(this.data.kbName)}` });
  },

  goToChat() {
    wx.navigateTo({ url: `/packageKnowledge/chat/index?kbId=${this.data.kbId}&kbName=${encodeURIComponent(this.data.kbName)}` });
  },
});
