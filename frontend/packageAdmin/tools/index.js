// packageAdmin/tools/index.js
const { request } = require("../../utils/request.js");

Page({
  data: {
    theme: "dark",
    tools: [],
    filteredTools: [],
    searchQuery: "",
    refreshing: false
  },

  onShow: function () {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({
        theme: app.globalData.theme === 'light' ? 'theme-light' : ''
      });
      app.applyTheme(app.globalData.theme);
    }
    this.loadTools();
  },

  loadTools: function () {
    this.setData({ refreshing: true });
    request({ url: "/api/v1/admin/tools" })
      .then((res) => {
        if (res.success && res.data) {
          const processed = res.data.map(item => {
            let formattedTime = "";
            if (item.createdAt) {
              const dt = new Date(item.createdAt);
              formattedTime = dt.toLocaleString();
            }
            return {
              ...item,
              formattedTime
            };
          });
          this.setData({
            tools: processed,
            filteredTools: this.filterTools(processed, this.data.searchQuery)
          });
        }
      })
      .catch((err) => {
        console.error("加载工具列表失败:", err);
        wx.showToast({ title: "加载系统工具失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ refreshing: false });
      });
  },

  onRefresh: function () {
    this.loadTools();
  },

  onSearchInput: function (e) {
    const query = e.detail.value;
    this.setData({
      searchQuery: query,
      filteredTools: this.filterTools(this.data.tools, query)
    });
  },

  filterTools: function (tools, query) {
    if (!query?.trim()) return tools;
    const q = query.toLowerCase().trim();
    return tools.filter(t => 
      t.name.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  },

  onStatusChange: function (e) {
    const name = e.currentTarget.dataset.name;
    const index = e.currentTarget.dataset.index;
    const isChecked = e.detail.checked;

    // 乐观更新
    const { filteredTools } = this.data;
    filteredTools[index].enabled = isChecked;
    this.setData({ filteredTools });

    request({
      url: "/api/v1/admin/tools/update",
      method: "PUT",
      data: {
        name,
        enabled: isChecked
      }
    })
      .then((res) => {
        if (res.success) {
          wx.showToast({
            title: isChecked ? "工具已上线启用" : "工具已停用下线",
            icon: "none"
          });
        } else {
          wx.showToast({ title: res.error || "状态更新失败", icon: "none" });
          // 回滚
          filteredTools[index].enabled = !isChecked;
          this.setData({ filteredTools });
        }
      })
      .catch((err) => {
        console.error("切换工具状态失败:", err);
        wx.showToast({ title: "网络异常，同步状态失败", icon: "none" });
        // 回滚
        filteredTools[index].enabled = !isChecked;
        this.setData({ filteredTools });
      });
  },

  onCreateTool: function () {
    wx.navigateTo({
      url: "/packageAdmin/tools/edit"
    });
  },

  onEditTool: function (e) {
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({
      url: `/packageAdmin/tools/edit?name=${name}`
    });
  },

  onDeleteTool: function (e) {
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: "下线确认",
      content: `确定要物理删除工具 "${name}" 吗？此操作不可逆，将影响使用此工具的 Agent。`,
      confirmColor: "#e06c75",
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: "删除中..." });
          request({
            url: `/api/v1/admin/tools/delete?name=${name}`,
            method: "DELETE"
          })
            .then((apiRes) => {
              wx.hideLoading();
              if (apiRes.success) {
                wx.showToast({ title: "工具删除成功", icon: "success" });
                this.loadTools();
              } else {
                wx.showToast({ title: apiRes.error || "删除失败", icon: "none" });
              }
            })
            .catch((err) => {
              wx.hideLoading();
              console.error("删除工具错误:", err);
              wx.showToast({ title: "系统请求异常", icon: "none" });
            });
        }
      }
    });
  }
});
