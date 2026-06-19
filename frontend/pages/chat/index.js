const { request } = require("../../utils/request.js");

Page({
  data: {
    currentTab: 'chat',
    messages: [],
    inputValue: "",
    sending: false,
  },

  onLoad() {
    this.addSystemMessage("你好！我是 Swarm AI 助手，有什么可以帮你的？");
  },

  addSystemMessage(content) {
    this.setData({
      messages: [...this.data.messages, { role: "assistant", content, isSystem: true }]
    });
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  async onSend() {
    const { inputValue, sending } = this.data;
    if (!inputValue.trim() || sending) return;

    const query = inputValue.trim();
    this.setData({ inputValue: "", sending: true });
    this.addMessage("user", query);

    const msgIdx = this.data.messages.length;
    this.setData({
      messages: [...this.data.messages, { role: "assistant", content: "", thinking: true }]
    });

    try {
      const res = await request({
        url: "/api/v1/tasks/create",
        method: "POST",
        data: {
          taskType: "AGENT_ORCHESTRATION",
          payload: {
            workflowName: "AI 对话",
            goal: query,
            agents: [],
            maxLoops: 3,
          },
        },
      });

      if (res.success) {
        const msgs = this.data.messages;
        msgs[msgIdx] = {
          role: "assistant",
          content: `已为您创建对话任务（任务ID: ${res.data.taskId}），请稍后在任务列表中查看完整回答。`,
        };
        this.setData({ messages: msgs, sending: false });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      const msgs = this.data.messages;
      msgs[msgIdx] = {
        role: "assistant",
        content: "抱歉，暂时无法处理您的请求，请稍后重试。",
        isError: true,
      };
      this.setData({ messages: msgs, sending: false });
    }
  },

  addMessage(role, content) {
    this.setData({
      messages: [...this.data.messages, { role, content }]
    });
  },
});
