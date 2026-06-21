const { request } = require("../../utils/request.js");
const marked = require("../../utils/marked.js");

Page({
  options: {
    styleIsolation: 'shared'
  },
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
    
    scrollTop: 0,
    keyboardHeight: 0,
    showNewMsgBadge: false,
    autoScroll: true,
    showDocPopup: false,
    selectedDoc: null,
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
    }
    this.addBotMsg(`你好！我是「${this.data.kbName}」助手。你可以问我关于知识库内容的任何问题。`);
  },

  onHide() {
    this.stopStreamRequest();
  },

  onUnload() {
    this.stopStreamRequest();
    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  },

  addBotMsg(content, sources) {
    const htmlContent = marked.parse ? marked.parse(content) : marked(content);
    this.setData({
      messages: [...this.data.messages, { id: "msg_bot_" + Date.now(), role: "assistant", content, htmlContent, sources: sources || [] }]
    });
  },

  addUserMsg(content) {
    this.setData({
      messages: [...this.data.messages, { id: "msg_user_" + Date.now(), role: "user", content }]
    });
  },

  onInput(e) { 
    this.setData({ inputValue: e.detail.value }); 
  },

  // ─── 软键盘高度自适应顶起 ───
  onInputFocus(e) {
    const keyboardHeight = e.detail.height || 0;
    this.setData({ keyboardHeight });
    this.scrollToBottom();
  },

  onInputBlur() {
    this.setData({ keyboardHeight: 0 });
  },

  // ─── 滚动锁定与防抖控制 (Scroll Anchoring) ───
  onScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.detail;
    this.scrollHeight = scrollHeight;
    this.clientHeight = clientHeight;

    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceToBottom < 50) {
      if (!this.data.autoScroll || this.data.showNewMsgBadge) {
        this.setData({
          autoScroll: true,
          showNewMsgBadge: false
        });
      }
    } else if (distanceToBottom >= 100) {
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

  // ─── 提取多轮历史对话上下文 (3轮历史) ───
  getChatHistory() {
    const history = [];
    const msgs = this.data.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.isSystem || m.isError || m.thinking || !m.content) continue;
      history.unshift({ role: m.role, content: m.content });
      if (history.length >= 6) break;
    }
    return history;
  },

  // ─── ArrayBuffer 字节解码为 UTF-8 ───
  ab2str(buf) {
    if (typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(new Uint8Array(buf));
    }
    const arr = new Uint8Array(buf);
    let str = "";
    for (let i = 0; i < arr.length; i++) {
      str += String.fromCharCode(arr[i]);
    }
    try {
      return decodeURIComponent(escape(str));
    } catch (_) {
      return str;
    }
  },

  // ─── 核心发送与后端 SSE Chunk 监听 ───
  async onSend() {
    const { inputValue, kbId, sending } = this.data;
    if (!inputValue.trim() || sending) return;

    const query = inputValue.trim();
    this.setData({ 
      inputValue: "", 
      sending: true,
      autoScroll: true,
      showNewMsgBadge: false
    });
    this.addUserMsg(query);

    const msgIdx = this.data.messages.length;
    const assistantMsgId = "msg_assistant_" + Date.now();
    this.setData({
      messages: [...this.data.messages, { id: assistantMsgId, role: "assistant", content: "", thinking: true }]
    });
    this.scrollToBottom();

    // 初始化打字缓冲器与 sources
    this.typewriterQueue = "";
    this.currentOutputText = "";
    this.currentSources = [];

    // 启动打字机定时消费
    this.startTypewriterTimer(msgIdx);

    const token = wx.getStorageSync('authToken') || '';
    const traceId = Math.random().toString(36).substring(2, 15);
    const header = {
      'Content-Type': 'application/json',
      'X-Trace-Id': traceId,
    };
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    // 开启微信 Chunked 模式网络请求
    this.requestTask = wx.request({
      url: 'https://swarm-gateway.jiuxia.online/api/v1/kb/chat',
      method: 'POST',
      enableChunked: true,
      header,
      data: {
        kbId,
        query,
        history: this.getChatHistory()
      },
      success: (res) => {
        this.setData({ sending: false });
      },
      fail: (err) => {
        console.error("知识库流式问答失败:", err);
        this.setAssistantError(msgIdx, "抱歉，知识库智能问答连接失败，请稍后重试。");
      }
    });

    // 监听分片到达
    this.requestTask.onChunkReceived((chunk) => {
      const text = this.ab2str(chunk.data);
      const lines = text.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 1. 处理自定义推送的 sources 文档来源事件
        if (trimmed.startsWith("event: sources")) {
          continue;
        }

        // 2. 解析 SSE data 分片
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.substring(6).trim();
          if (dataStr === "[DONE]") {
            this.stopStreamRequest();
            continue;
          }

          // 识别 sources 数据数组 (来自 `event: sources` 的下一行 data)
          if (dataStr.startsWith("[") && dataStr.endsWith("]")) {
            try {
              const parsedSources = JSON.parse(dataStr);
              if (Array.isArray(parsedSources)) {
                this.currentSources = parsedSources;
                const msgs = this.data.messages;
                if (msgs[msgIdx]) {
                  msgs[msgIdx].sources = this.currentSources;
                  this.setData({ messages: msgs });
                }
                continue;
              }
            } catch (_) {}
          }

          // 识别大模型 response 文本片
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.response || parsed.text || "";
            if (delta) {
              this.typewriterQueue += delta;
            }
          } catch (_) {}
        }
      }
    });
  },

  startTypewriterTimer(msgIdx) {
    if (this.typewriterTimer) clearInterval(this.typewriterTimer);

    this.typewriterTimer = setInterval(() => {
      if (this.typewriterQueue.length > 0) {
        // 根据延迟自适应出字步长
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
          msgs[msgIdx].typing = true; // 显示闪烁光标
          msgs[msgIdx].sources = this.currentSources;
        }

        this.setData({ messages: msgs });

        if (this.data.autoScroll) {
          this.scrollToBottom();
        } else {
          this.setData({ showNewMsgBadge: true });
        }
      } else {
        // 队列清空且请求已结束，移除闪烁光标
        const msgs = this.data.messages;
        if (msgs[msgIdx] && !this.data.sending) {
          msgs[msgIdx].typing = false;
          this.setData({ messages: msgs });
          clearInterval(this.typewriterTimer);
          this.typewriterTimer = null;
        }
      }
    }, 40);
  },

  stopStreamRequest() {
    this.setData({ sending: false });
    if (this.requestTask) {
      try {
        this.requestTask.abort();
      } catch (_) {}
      this.requestTask = null;
    }
  },

  setAssistantError(msgIdx, errMsg) {
    const msgs = this.data.messages;
    const htmlContent = marked.parse ? marked.parse(errMsg) : marked(errMsg);
    if (msgs[msgIdx]) {
      msgs[msgIdx] = {
        id: msgs[msgIdx].id || ("msg_error_" + Date.now()),
        role: "assistant",
        content: errMsg,
        htmlContent: htmlContent,
        isError: true,
        thinking: false,
        typing: false,
        sources: []
      };
      this.setData({ messages: msgs, sending: false });
      this.scrollToBottom();
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

  // ── 显示文档详情 ──
  async showDocDetail(e) {
    const title = e.currentTarget.dataset.title || "";
    if (!title) return;

    this.setData({
      showDocPopup: true,
      selectedDocTitle: title,
      selectedDocContent: "",
      selectedDoc: null,
      docDetailLoading: true
    });

    try {
      // 1. 如果本地缓存的文档列表为空，则发起网络请求拉取
      if (!this.data.documents || this.data.documents.length === 0) {
        const res = await request({ url: `/api/v1/kb/document/list?kbId=${this.data.kbId}` });
        if (res && res.success) {
          this.setData({
            documents: res.data || []
          });
        } else {
          throw new Error("获取文档列表失败");
        }
      }

      // 2. 宽松匹配匹配文档
      const docs = this.data.documents || [];
      const cleanTitle = (t) => t.replace(/\.[^/.]+$/, "").trim().toLowerCase();
      const targetClean = cleanTitle(title);

      const matchedDoc = docs.find(doc => {
        const docClean = cleanTitle(doc.title);
        return docClean === targetClean || doc.title.trim().toLowerCase() === title.trim().toLowerCase();
      });

      if (matchedDoc) {
        const content = matchedDoc.rawContent || "";
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
          selectedDoc: matchedDoc,
          selectedDocContent: htmlContent,
          docDetailLoading: false
        });
      } else {
        console.warn(`未匹配到文档详情: ${title}`);
        this.setData({
          selectedDocContent: "",
          docDetailLoading: false
        });
      }
    } catch (err) {
      console.error("加载文档详情失败:", err);
      this.setData({
        selectedDocContent: "",
        docDetailLoading: false
      });
      wx.showToast({
        title: "获取文档详情失败",
        icon: "none"
      });
    }
  },

  // ── 关闭文档详情抽屉 ──
  onCloseDocPopup() {
    this.setData({
      showDocPopup: false,
      selectedDoc: null
    });
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
