const { request } = require("../../utils/request.js");

Page({
  data: {
    kbList: [],
    loading: false,
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
      const res = await request({ url: "/api/v1/admin/knowledge-bases" });
      if (res.success) {
        this.setData({ kbList: res.data || [] });
      }
    } catch (err) {
      console.error("获取知识库列表失败", err);
      wx.showToast({ title: "获取列表失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 创建知识库
  showCreateDialog() {
    this.setData({ showCreateDialog: true, newKBName: "", newKBDesc: "" });
  },

  onCancelCreate() {
    this.setData({ showCreateDialog: false });
  },

  onKBNameInput(e) {
    this.setData({ newKBName: e.detail.value });
  },

  onKBDescInput(e) {
    this.setData({ newKBDesc: e.detail.value });
  },

  async onCreateKB() {
    if (!this.data.newKBName.trim()) {
      wx.showToast({ title: "请输入知识库名称", icon: "none" });
      return;
    }
    try {
      const res = await request({
        url: "/api/v1/kb/create",
        method: "POST",
        data: {
          name: this.data.newKBName.trim(),
          description: this.data.newKBDesc.trim() || undefined,
        },
      });
      if (res.success) {
        wx.showToast({ title: "创建成功", icon: "success" });
        this.setData({ showCreateDialog: false });
        this.fetchKBList();
      } else {
        wx.showToast({ title: res.error || "创建失败", icon: "none" });
      }
    } catch (err) {
      wx.showToast({ title: "创建失败", icon: "none" });
    }
  },

  // 进入知识库详情
  goToDetail(e) {
    const kbId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/packageAdmin/knowledge/detail?kbId=${kbId}` });
  },

  // 删除知识库
  onDeleteKB(e) {
    const kb = e.currentTarget.dataset.kb;
    wx.showModal({
      title: "确认删除",
      content: `确定删除知识库"${kb.name}"吗？文档和向量数据将一并清除。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await request({
              url: `/api/v1/kb/delete?kbId=${kb.id}`,
              method: "DELETE",
            });
            if (result.success) {
              wx.showToast({ title: "删除成功", icon: "success" });
              this.fetchKBList();
            } else {
              wx.showToast({ title: result.error || "删除失败", icon: "none" });
            }
          } catch (err) {
            wx.showToast({ title: "删除失败", icon: "none" });
          }
        }
      },
    });
  },
});
