const { request } = require("../../utils/request.js");

Page({
  data: {
    kbId: "",
    kbName: "",
    activeTab: "manual",
    submitting: false,
    result: null, // { success, message, docId }

    // 手动录入
    manualTitle: "",
    manualContent: "",

    // 网页抓取
    url: "",
    urlTitle: "",

    // 批量录入
    batchText: "",
    batchTitle: "",

    // autosize 配置
    autoSizeObj: { minRows: 5, maxRows: 12 },
    autoSizeObjBig: { minRows: 6, maxRows: 15 },
  },

  onLoad(options) {
    if (options.kbId) {
      this.setData({
        kbId: options.kbId,
        kbName: decodeURIComponent(options.kbName || "知识库"),
      });
      wx.setNavigationBarTitle({ title: `添加文档 - ${this.data.kbName}` });
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.value, result: null });
  },

  // ── 输入事件 ──
  onManualTitleInput(e) { this.setData({ manualTitle: e.detail.value }); },
  onManualContentInput(e) { this.setData({ manualContent: e.detail.value }); },
  onUrlInput(e) { this.setData({ url: e.detail.value }); },
  onUrlTitleInput(e) { this.setData({ urlTitle: e.detail.value }); },
  onBatchTitleInput(e) { this.setData({ batchTitle: e.detail.value }); },
  onBatchTextInput(e) { this.setData({ batchText: e.detail.value }); },

  // ── 手动录入提交 ──
  async submitManual() {
    const { manualTitle, manualContent } = this.data;
    if (!manualTitle.trim()) { wx.showToast({ title: "请输入标题", icon: "none" }); return; }
    if (!manualContent.trim()) { wx.showToast({ title: "请输入内容", icon: "none" }); return; }
    if (manualContent.trim().length < 10) { wx.showToast({ title: "内容至少 10 个字", icon: "none" }); return; }

    await this.submit("/api/v1/kb/document/manual", {
      kbId: this.data.kbId,
      title: manualTitle.trim(),
      content: manualContent.trim(),
    });
  },

  // ── 网页抓取提交 ──
  async submitUrl() {
    const { url } = this.data;
    if (!url.trim()) { wx.showToast({ title: "请输入网页 URL", icon: "none" }); return; }

    await this.submit("/api/v1/kb/document/url", {
      kbId: this.data.kbId,
      url: url.trim(),
      title: this.data.urlTitle.trim() || undefined,
    });
  },

  // ── 批量录入提交 ──
  async submitBatch() {
    const { batchTitle, batchText } = this.data;
    if (!batchText.trim()) { wx.showToast({ title: "请输入内容", icon: "none" }); return; }

    // 按双换行分割成多个文档
    const paragraphs = batchText.trim().split(/\n\n+/).filter(p => p.trim().length > 10);
    if (paragraphs.length === 0) {
      wx.showToast({ title: "内容至少包含一段有效文本（10字以上）", icon: "none" }); return;
    }

    this.setData({ submitting: true, result: null });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      try {
        const res = await request({
          url: "/api/v1/kb/document/manual", method: "POST",
          data: {
            kbId: this.data.kbId,
            title: batchTitle.trim() ? `${batchTitle.trim()} 第${i + 1}段` : `文档片段 ${i + 1}`,
            content: paragraphs[i].trim(),
          },
        });
        if (res.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    this.setData({
      submitting: false,
      result: {
        success: successCount > 0,
        message: `提交完成：${successCount} 篇成功${failCount > 0 ? `，${failCount} 篇失败` : ''}`,
      },
    });
    if (successCount > 0) this.setData({ batchText: "" });
  },

  // ── 通用提交 ──
  async submit(url, data) {
    this.setData({ submitting: true, result: null });
    try {
      const res = await request({ url, method: "POST", data });
      if (res.success) {
        this.setData({
          submitting: false,
          result: { success: true, message: "文档已提交，后台正在处理中", docId: res.data?.docId },
          manualTitle: "", manualContent: "", url: "", urlTitle: "",
        });
      } else {
        this.setData({ submitting: false, result: { success: false, message: res.error || "提交失败" } });
      }
    } catch (err) {
      this.setData({ submitting: false, result: { success: false, message: "网络错误，请重试" } });
    }
  },

  // ── 返回 ──
  goBack() {
    wx.navigateBack();
  },

  goToDetail() {
    wx.redirectTo({ url: `/packageKnowledge/detail/index?kbId=${this.data.kbId}&kbName=${encodeURIComponent(this.data.kbName)}` });
  },
});
