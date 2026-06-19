const { request } = require("../../utils/request.js");

Page({
  data: {
    currentTab: 'knowledge',
    kbId: "",
    kbName: "",
    messages: [],
    inputValue: "",
    sending: false,
    showSidebar: false,
    documents: [],
    docLoading: false,
  },

  onLoad(options) {
    if (options.kbId) {
      this.setData({
        kbId: options.kbId,
        kbName: decodeURIComponent(options.kbName || "知识库"),
      });
      wx.setNavigationBarTitle({ title: this.data.kbName });
    }
    this.addBotMsg(`你好！我是「${this.data.kbName}」助手。你可以问我关于知识库内容的任何问题。`);
  },

  addBotMsg(content, sources) {
    this.setData({
      messages: [...this.data.messages, { role: "assistant", content, sources: sources || [] }]
    });
  },

  addUserMsg(content) {
    this.setData({
      messages: [...this.data.messages, { role: "user", content }]
    });
  },

  onInput(e) { this.setData({ inputValue: e.detail.value }); },

  async onSend() {
    const { inputValue, kbId, sending } = this.data;
    if (!inputValue.trim() || sending) return;

    const query = inputValue.trim();
    this.setData({ inputValue: "", sending: true });
    this.addUserMsg(query);

    const msgIdx = this.data.messages.length;
    this.setData({ messages: [...this.data.messages, { role: "assistant", content: "", thinking: true }] });

    try {
      // 1. 检索知识库
      const searchRes = await request({
        url: "/api/v1/kb/search", method: "POST",
        data: { kbId, query, topK: 5, minScore: 0.3 },
      });

      let context = "";
      let sources = [];

      if (searchRes.success && searchRes.data?.results?.length > 0) {
        const results = searchRes.data.results;
        context = results.map((r, i) => `【参考 ${i + 1}】${r.content}`).join("\n\n");
        sources = [...new Set(results.map(r => r.documentTitle))];
      }

      // 2. 组装回答
      let answer = "";
      if (context) {
        answer = `根据知识库中的信息，以下是相关内容：\n\n`;
        // 取前3条最有价值的参考
        const topResults = searchRes.data.results.slice(0, 3);
        topResults.forEach((r, i) => {
          answer += `**参考 ${i + 1}**（来自《${r.documentTitle}》）\n${r.content.slice(0, 300)}${r.content.length > 300 ? '...' : ''}\n\n`;
        });
        answer += `以上内容来自 ${sources.join('、')} 等文档。`;
      } else {
        answer = "抱歉，知识库中没有找到与您问题相关的信息。您可以换个关键词试试，或联系管理员添加相关文档。";
      }

      // 3. 更新消息
      const msgs = this.data.messages;
      msgs[msgIdx] = { role: "assistant", content: answer, sources };
      this.setData({ messages: msgs, sending: false });

    } catch (err) {
      const msgs = this.data.messages;
      msgs[msgIdx] = { role: "assistant", content: "抱歉，查询失败，请稍后重试。", isError: true };
      this.setData({ messages: msgs, sending: false });
    }
  },

  // ── 侧栏：查看文档 ──
  toggleSidebar() {
    if (this.data.showSidebar) { this.setData({ showSidebar: false }); return; }
    this.setData({ showSidebar: true, docLoading: true });
    request({ url: `/api/v1/kb/document/list?kbId=${this.data.kbId}` })
      .then(res => { if (res.success) this.setData({ documents: res.data || [], docLoading: false }); })
      .catch(() => this.setData({ docLoading: false }));
  },
});
