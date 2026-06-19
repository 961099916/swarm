const { request } = require("../../../utils/request.js");

Page({
  data: {
    kbId: "",
    kbInfo: null,
    documents: [],
    loading: false,
    // 手动录入弹窗
    showManualDialog: false,
    manualTitle: "",
    manualContent: "",
    // 网页抓取弹窗
    showUrlDialog: false,
    urlInput: "",
    urlTitle: "",
  },

  onLoad(options) {
    if (options.kbId) {
      this.setData({ kbId: options.kbId });
      this.loadKBInfo();
      this.loadDocuments();
    }
  },

  async loadKBInfo() {
    try {
      const res = await request({ url: `/api/v1/kb/get?kbId=${this.data.kbId}` });
      if (res.success) {
        this.setData({ kbInfo: res.data });
        wx.setNavigationBarTitle({ title: res.data.name });
      }
    } catch (err) {
      console.error("获取知识库信息失败", err);
    }
  },

  async loadDocuments() {
    this.setData({ loading: true });
    try {
      const res = await request({ url: `/api/v1/kb/document/list?kbId=${this.data.kbId}` });
      if (res.success) {
        this.setData({ documents: res.data || [] });
      }
    } catch (err) {
      console.error("获取文档列表失败", err);
    } finally {
      this.setData({ loading: false });
    }
  },

  // ── 手动录入 ──
  showManualDialog() {
    this.setData({ showManualDialog: true, manualTitle: "", manualContent: "" });
  },
  onManualCancel() { this.setData({ showManualDialog: false }); },
  onManualTitleInput(e) { this.setData({ manualTitle: e.detail.value }); },
  onManualContentInput(e) { this.setData({ manualContent: e.detail.value }); },

  async onManualSubmit() {
    if (!this.data.manualTitle.trim() || !this.data.manualContent.trim()) {
      wx.showToast({ title: "标题和内容不能为空", icon: "none" });
      return;
    }
    try {
      const res = await request({
        url: "/api/v1/kb/document/manual",
        method: "POST",
        data: {
          kbId: this.data.kbId,
          title: this.data.manualTitle.trim(),
          content: this.data.manualContent.trim(),
        },
      });
      if (res.success) {
        wx.showToast({ title: "已提交处理", icon: "success" });
        this.setData({ showManualDialog: false });
        this.loadDocuments();
      }
    } catch (err) {
      wx.showToast({ title: "提交失败", icon: "none" });
    }
  },

  // ── 网页抓取 ──
  showUrlDialog() {
    this.setData({ showUrlDialog: true, urlInput: "", urlTitle: "" });
  },
  onUrlCancel() { this.setData({ showUrlDialog: false }); },
  onUrlInput(e) { this.setData({ urlInput: e.detail.value }); },
  onUrlTitleInput(e) { this.setData({ urlTitle: e.detail.value }); },

  async onUrlSubmit() {
    if (!this.data.urlInput.trim()) {
      wx.showToast({ title: "请输入URL", icon: "none" });
      return;
    }
    try {
      const res = await request({
        url: "/api/v1/kb/document/url",
        method: "POST",
        data: {
          kbId: this.data.kbId,
          url: this.data.urlInput.trim(),
          title: this.data.urlTitle.trim() || undefined,
        },
      });
      if (res.success) {
        wx.showToast({ title: "已提交抓取", icon: "success" });
        this.setData({ showUrlDialog: false });
        this.loadDocuments();
      }
    } catch (err) {
      wx.showToast({ title: "提交失败", icon: "none" });
    }
  },

  // ── 删除文档 ──
  onDeleteDoc(e) {
    const doc = e.currentTarget.dataset.doc;
    wx.showModal({
      title: "确认删除",
      content: `删除文档"${doc.title}"？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await request({
              url: `/api/v1/kb/document/delete?docId=${doc.id}`,
              method: "DELETE",
            });
            if (result.success) {
              wx.showToast({ title: "删除成功", icon: "success" });
              this.loadDocuments();
            }
          } catch (err) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      },
    });
  },

  // ── 搜索知识库 ──
  goToSearch() {
    wx.navigateTo({ url: `/packageAdmin/knowledge/search?kbId=${this.data.kbId}` });
  },
});
