const { request } = require("../../utils/request.js");
const marked = require("../../utils/marked.js");

Page({
  options: {
    styleIsolation: 'shared'
  },
  data: {
    kbId: "",
    kbName: "",
    kbInfo: null,
    documents: [],
    loading: false,
    theme: "",
    showDocPopup: false,
    selectedDoc: null, // 选中的文档对象
    selectedDocTitle: "",
    selectedDocContent: "",
    docDetailLoading: false,
  },

  onLoad(options) {
    if (options.kbId) {
      this.setData({
        kbId: options.kbId,
        kbName: decodeURIComponent(options.kbName || "知识库"),
      });
      wx.setNavigationBarTitle({ title: this.data.kbName });
      this.loadKBInfo();
    }
  },

  onShow() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({
        theme: app.globalData.theme === "light" ? "theme-light" : "",
      });
      app.applyTheme(app.globalData.theme);
    }
    if (wx.hideHomeButton) {
      wx.hideHomeButton();
    }
    if (this.data.kbId) {
      this.loadDocuments();
    }
  },

  async loadKBInfo() {
    try {
      // 兼容无单体获取接口的限制，从列表接口中过滤出指定 ID 的知识库信息
      const res = await request({ url: "/api/v1/kb/list?limit=100" });
      if (res.success) {
        const list = res.list || res.data || [];
        const kbInfo = list.find(k => k.id === this.data.kbId);
        if (kbInfo) {
          this.setData({ kbInfo });
          return;
        }
      }
      throw new Error("知识库未找到");
    } catch (err) {
      console.error("获取知识库信息失败，执行容错降级:", err);
      // 容错兜底，保证在列表为空或接口失效时页面能基于 onLoad 传入的值优雅展示
      this.setData({
        kbInfo: {
          name: this.data.kbName,
          description: "知识库文档管理",
          chunkSize: 500,
          chunkOverlap: 50,
          isPublic: false
        }
      });
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

  // ── 显示文档详情 ──
  showDocDetail(e) {
    const doc = e.currentTarget.dataset.doc;
    if (!doc) return;

    this.setData({
      showDocPopup: true,
      selectedDoc: doc,
      selectedDocTitle: doc.title,
      selectedDocContent: "",
      docDetailLoading: true
    });

    try {
      const content = doc.rawContent || "";
      let htmlContent = "";

      // 智能识别：HTML网页 / Markdown文档 / 格式化纯文本，提供自适应排版
      const isHtml = /<[a-z/][\s\S]*>/i.test(content);
      const hasMarkdown = /[#*_\-`\[\]]/.test(content);

      if (isHtml) {
        htmlContent = content;
      } else if (hasMarkdown) {
        htmlContent = marked.parse ? marked.parse(content) : marked(content);
      } else {
        // 普通纯文本：通过换行符智能切割并封装为段落，增加 2em 缩进和行距
        const escaped = content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        htmlContent = escaped
          .split(/\n\n+/)
          .map(para => `<p style="margin-bottom: 24rpx; text-indent: 2em; line-height: 1.8;">${para.trim().replace(/\n/g, "<br/>")}</p>`)
          .join("");
      }

      this.setData({
        selectedDocContent: htmlContent,
        docDetailLoading: false
      });
    } catch (err) {
      console.error("解析 Markdown 失败:", err);
      this.setData({
        selectedDocContent: doc.rawContent || "暂无文档内容",
        docDetailLoading: false
      });
    }
  },

  onCloseDocPopup() {
    this.setData({ showDocPopup: false });
  },

  // ── 预览 Office/PDF 原件 ──
  previewDocument() {
    const doc = this.data.selectedDoc;
    if (!doc || !doc.sourceUrl) {
      wx.showToast({ title: "原件下载链接不存在", icon: "none" });
      return;
    }

    wx.showLoading({ title: "正在下载原件..." });

    wx.downloadFile({
      url: doc.sourceUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          const filePath = res.tempFilePath;
          wx.openDocument({
            filePath: filePath,
            showMenu: true,
            success: () => {
              wx.hideLoading();
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({ title: "暂不支持该格式预览", icon: "none" });
              console.error("打开文档失败", err);
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: "下载文件失败", icon: "none" });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({ title: "下载原件失败，请重试", icon: "none" });
        console.error("下载文件失败", err);
      }
    });
  },

  // ── 复制网页原文链接 ──
  copySourceUrl() {
    const doc = this.data.selectedDoc;
    if (!doc || !doc.sourceUrl) {
      wx.showToast({ title: "原文链接不存在", icon: "none" });
      return;
    }

    wx.setClipboardData({
      data: doc.sourceUrl,
      success: () => {
        wx.showToast({ title: "链接已复制", icon: "success" });
      }
    });
  },
});
