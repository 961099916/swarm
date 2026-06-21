const { request } = require("../../utils/request.js");
const marked = require("../../utils/marked.js");

Page({
  data: {
    currentTab: 'chat',
    messages: [],
    inputValue: "",
    sending: false,
    scrollTop: 0,
    keyboardHeight: 0,
    showNewMsgBadge: false,
    autoScroll: true,
  },

  onLoad() {
    this.addSystemMessage("你好！我是 Swarm AI 助手，有什么可以帮你的？");
  },

  onHide() {
    this.stopPollingAndTimers();
  },

  onUnload() {
    this.stopPollingAndTimers();
    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  },

  addSystemMessage(content) {
    const htmlContent = marked.parse ? marked.parse(content) : marked(content);
    this.setData({
      messages: [...this.data.messages, { id: "msg_sys_" + Date.now(), role: "assistant", content, htmlContent, isSystem: true }]
    });
  },

  addMessage(role, content) {
    this.setData({
      messages: [...this.data.messages, { id: `msg_${role}_${Date.now()}_${Math.floor(Math.random() * 1000)}`, role, content }]
    });
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  // ─── 软键盘高度自适应平滑顶起 ───
  onInputFocus(e) {
    const keyboardHeight = e.detail.height || 0;
    this.setData({ keyboardHeight });
    this.scrollToBottom();
  },

  onInputBlur() {
    this.setData({ keyboardHeight: 0 });
  },

  // ─── 滚动锚定锁屏计算 (Scroll Anchoring) ───
  onScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.detail;
    this.scrollHeight = scrollHeight;
    this.clientHeight = clientHeight;

    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    // 触底判定：如果距离底部小于 50px，激活自动跟随，隐藏新消息球
    if (distanceToBottom < 50) {
      if (!this.data.autoScroll || this.data.showNewMsgBadge) {
        this.setData({
          autoScroll: true,
          showNewMsgBadge: false
        });
      }
    } else if (distanceToBottom >= 100) {
      // 锁屏判定：如果距离底部大于等于 100px，表明用户手动滑起，停止跟随
      if (this.data.autoScroll) {
        this.setData({
          autoScroll: false
        });
      }
    }
  },

  scrollToBottom() {
    if (!this.data.autoScroll) return;
    this.forceScrollToBottom();
  },

  forceScrollToBottom() {
    const targetScrollTop = (this.scrollHeight || 10000) + Math.random();
    this.setData({
      scrollTop: targetScrollTop,
      autoScroll: true,
      showNewMsgBadge: false
    });
  },

  // ─── 核心发送与异步流式模拟 (SSE / Logs Polling) ───
  async onSend() {
    const { inputValue, sending } = this.data;
    if (!inputValue.trim() || sending) return;

    const query = inputValue.trim();
    this.setData({ 
      inputValue: "", 
      sending: true,
      autoScroll: true,
      showNewMsgBadge: false
    });
    this.addMessage("user", query);

    const msgIdx = this.data.messages.length;
    this.setData({
      messages: [...this.data.messages, { id: "msg_assistant_" + Date.now() + "_" + Math.floor(Math.random() * 1000), role: "assistant", content: "", thinking: true }]
    });
    this.scrollToBottom();

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

      if (res.success && res.data?.taskId) {
        const taskId = res.data.taskId;
        this.startTaskPolling(taskId, msgIdx);
      } else {
        throw new Error(res.error || "创建任务失败");
      }
    } catch (err) {
      this.setAssistantError(msgIdx, err.message || "抱歉，暂时无法处理您的请求，请稍后重试。");
    }
  },

  startTaskPolling(taskId, msgIdx) {
    let pollCount = 0;
    const maxPolls = 60; // 最多轮询 60 次（90 秒）

    this.typewriterQueue = "";
    this.currentOutputText = "";
    this.lastLogsText = "";

    // 立即执行第一次拉取
    this.pollLogs(taskId, msgIdx);

    this.pollingTimer = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        this.stopPollingAndTimers();
        this.setAssistantError(msgIdx, "任务执行超时，请在任务列表中查看后续进展。");
        return;
      }

      const isFinished = await this.pollLogs(taskId, msgIdx);
      if (isFinished) {
        this.stopPollingAndTimers();
      }
    }, 1500);

    // 启动打字机平滑消费定时器
    this.startTypewriterTimer(msgIdx);
  },

  async pollLogs(taskId, msgIdx) {
    try {
      const logsRes = await request({ url: `/api/v1/tasks/logs?taskId=${taskId}` });
      const taskListRes = await request({ url: "/api/v1/tasks/list?limit=50" });

      let taskStatus = "PENDING";
      let resultSummary = "";

      if (taskListRes.success && taskListRes.data) {
        const currentTask = taskListRes.data.find(t => t.id === taskId);
        if (currentTask) {
          taskStatus = currentTask.status;
          resultSummary = currentTask.result_summary || "";
        }
      }

      let parsedLogsText = "";
      if (logsRes.success && logsRes.data?.logs) {
        const logs = logsRes.data.logs;
        for (const log of logs) {
          const msg = log.message || "";
          if (msg.startsWith("[AI_CHAT]")) {
            const jsonStr = msg.substring(9).trim();
            try {
              const payload = JSON.parse(jsonStr);
              if (payload.response) {
                parsedLogsText = payload.response;
              }
            } catch (_) {}
          }
        }
      }

      let newTargetText = parsedLogsText || resultSummary;

      // 如果依然没有得到有效文本，且任务已进终态，提取最终报错或结果
      if (!newTargetText && (taskStatus === "COMPLETED" || taskStatus === "FAILED")) {
        newTargetText = resultSummary || (taskStatus === "COMPLETED" ? "任务已成功执行完成。" : "任务执行失败，详情请查看任务日志。");
      }

      if (newTargetText && newTargetText !== this.lastLogsText) {
        const newChars = newTargetText.slice(this.lastLogsText.length);
        this.typewriterQueue += newChars;
        this.lastLogsText = newTargetText;
      }

      if (taskStatus === "COMPLETED" || taskStatus === "FAILED") {
        return true;
      }
      return false;
    } catch (err) {
      console.error("轮询日志遇到错误:", err);
      return false;
    }
  },

  startTypewriterTimer(msgIdx) {
    if (this.typewriterTimer) clearInterval(this.typewriterTimer);

    this.typewriterTimer = setInterval(() => {
      if (this.typewriterQueue.length > 0) {
        // 根据待处理队列长度，自适应计算吐字步长（消除延迟感）
        const step = this.typewriterQueue.length > 30 ? 4 : this.typewriterQueue.length > 10 ? 2 : 1;
        const printChars = this.typewriterQueue.slice(0, step);
        this.typewriterQueue = this.typewriterQueue.slice(step);

        this.currentOutputText += printChars;
        const htmlContent = marked.parse ? marked.parse(this.currentOutputText) : marked(this.currentOutputText);

        const msgs = this.data.messages;
        if (msgs[msgIdx]) {
          msgs[msgIdx].thinking = false;
          msgs[msgIdx].content = this.currentOutputText;
          msgs[msgIdx].htmlContent = htmlContent;
          msgs[msgIdx].typing = true; // 开启闪烁光标
        }

        this.setData({ messages: msgs });

        if (this.data.autoScroll) {
          this.scrollToBottom();
        } else {
          this.setData({ showNewMsgBadge: true });
        }
      } else {
        // 队列消费空，并且轮询也已停止时，关闭闪烁光标并注销定时器
        const msgs = this.data.messages;
        if (msgs[msgIdx] && !this.pollingTimer) {
          msgs[msgIdx].typing = false;
          this.setData({ messages: msgs });
          clearInterval(this.typewriterTimer);
          this.typewriterTimer = null;
        }
      }
    }, 40);
  },

  stopPollingAndTimers() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.setData({ sending: false });
  },

  setAssistantError(msgIdx, errMsg) {
    const msgs = this.data.messages;
    const htmlContent = marked.parse ? marked.parse(errMsg) : marked(errMsg);
    if (msgs[msgIdx]) {
      msgs[msgIdx] = {
        id: msgs[msgIdx].id || ("msg_error_" + Date.now() + "_" + Math.floor(Math.random() * 1000)),
        role: "assistant",
        content: errMsg,
        htmlContent: htmlContent,
        isError: true,
        thinking: false,
        typing: false
      };
      this.setData({ messages: msgs, sending: false });
      this.scrollToBottom();
    }
  }
});
