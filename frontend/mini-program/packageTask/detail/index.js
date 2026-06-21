const { POLLING_INTERVAL_MS } = require("../../utils/constants.js");
const { request } = require("../../utils/request.js");
const { processTaskItem, formatTimeHms } = require("../../utils/taskHelper.js");

Page({
  data: {
    theme: "dark",
    taskId: "",
    taskInfo: {},
    logs: [],
    scrollTop: 0,
    timer: null,
    workflowSteps: [],
  },

 onLoad: function (options) {
   if (options && options.taskId) {
     this.setData({ taskId: options.taskId });
   }
    // 在页面首次渲染前同步主题，避免 onShow 延迟导致视觉跳变
    const app = getApp();
    if (app && app.globalData && app.globalData.theme === "light") {
      this.setData({ theme: "theme-light" });
    }
 },

  onShow: function () {
    const app = getApp();
    if (app && app.globalData) {
      // onLoad 已同步主题，此处只需恢复 polling
      this.setData({
        theme: app.globalData.theme === "light" ? "theme-light" : "",
      });
      app.applyTheme(app.globalData.theme);
    }

    const token = wx.getStorageSync("authToken");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }

    this.startPolling();
  },

  onHide: function () {
    this.clearTimer();
  },

  onUnload: function () {
    this.clearTimer();
  },

  startPolling: function () {
    this.loadLogsAndStatus();

    const timer = setInterval(() => {
      const status = this.data.taskInfo.status;
      if (status === "RUNNING" || status === "PENDING" || !status) {
        this.loadLogsAndStatus();
      }
    }, POLLING_INTERVAL_MS);

    this.setData({ timer });
  },

  clearTimer: function () {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  loadLogsAndStatus: function () {
    const { taskId, logs: oldLogs } = this.data;
    if (!taskId) return Promise.resolve();

    const statusPromise = request({ url: "/api/v1/tasks/list?limit=100" })
      .then((res) => {
        if (res.success && res.data) {
          const currentTask = res.data.find((t) => t.id === taskId);
          if (currentTask) {
            this.setData({
              taskInfo: processTaskItem(currentTask),
            });
          }
        }
      })
      .catch((err) => {
        console.error("加载详情页面任务属性出错:", err);
      });

    const logsPromise = request({ url: `/api/v1/tasks/logs?taskId=${taskId}` })
      .then((res) => {
        if (res.success && res.data) {
          const newLogs = res.data.logs || [];
          const logs = newLogs.map((newLog, idx) => {
            const oldLog = oldLogs[idx];
            return {
              ...newLog,
              formattedTime: formatTimeHms(newLog.createdAt),
              parsed: this.parseMessage(newLog.message),
              expanded: oldLog ? oldLog.expanded : false,
            };
          });
          this.setData({ logs }, () => {
            this.parseWorkflowSteps(this.data.taskInfo, logs);
          });
          this.scrollToBottom();
        }
      })
      .catch((err) => {
        console.error("加载详情日志出错:", err);
      });

    return Promise.all([statusPromise, logsPromise]);
  },

  scrollToBottom: function () {
    setTimeout(() => {
      const len = this.data.logs.length;
      this.setData({ scrollTop: len * 150 + 500 });
    }, 100);
  },

  toggleLogExpand: function (e) {
    const idx = e.currentTarget.dataset.index;
    const logs = [...this.data.logs];
    if (logs[idx]) {
      logs[idx].expanded = !logs[idx].expanded;
      this.setData({ logs });
    }
  },

  copyResponseText: function (e) {
    const text = e.currentTarget.dataset.text;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: "复制成功", icon: "success" });
      },
    });
  },

  // ─── 日志消息解析 ───

  parseMessage: function (message) {
    if (!message) return { prefix: "", body: "", type: "normal" };

    if (message.startsWith("[AI_CHAT]")) {
      const jsonStr = message.substring(9).trim();
      try {
        const payload = JSON.parse(jsonStr);
        const systemPrompt = this.getSystemPrompt(payload.messages);
        const userMessages = this.getUserMessages(payload.messages);
        return {
          prefix: "",
          body: payload,
          bodyPreview: {
            messages: JSON.stringify(payload.messages, null, 2),
            response: typeof payload.response === 'string' ? payload.response : JSON.stringify(payload.response, null, 2)
          },
          systemPrompt,
          userMessages,
          type: "ai-chat",
        };
      } catch (_e) {
        return {
          prefix: "[AI 推理异常]",
          body: { response: jsonStr, error: "AI 结构化日志协议 JSON 解析失败", success: false },
          type: "ai-chat",
        };
      }
    }

    if (message.startsWith("[Step-START]")) {
      return { prefix: "[工作流步骤]", body: message.substring(12).trim(), type: "step-start" };
    }
    if (message.startsWith("[Step-SUCCESS]")) {
      return { prefix: "[步骤完成]", body: message.substring(14).trim(), type: "step-success" };
    }
    if (message.startsWith("[Step-FAILED]")) {
      return { prefix: "[步骤失败]", body: message.substring(13).trim(), type: "step-failed" };
    }
    if (message.startsWith("[Step-BRANCH]")) {
      return { prefix: "[分支跳转]", body: message.substring(13).trim(), type: "step-branch" };
    }

    if (message.startsWith("[主控]")) {
      return { prefix: "[主控协调官]", body: message.substring(4).trim(), type: "supervisor" };
    }

    const toolMatch = message.match(/^\[工具\s*-\s*([^\]]+)\]/);
    if (toolMatch) {
      return {
        prefix: `[工具:${toolMatch[1]}]`,
        body: message.substring(toolMatch[0].length).trim(),
        type: "tool",
      };
    }

    const agentMatch = message.match(/^\[智能体\s*-\s*([^\]]+)\]/);
    if (agentMatch) {
      return {
        prefix: `[智能体:${agentMatch[1]}]`,
        body: message.substring(agentMatch[0].length).trim(),
        type: "agent",
      };
    }

    return { prefix: "", body: message, type: "normal" };
  },

  getSystemPrompt: function (messages) {
    if (!Array.isArray(messages)) return "";
    const sys = messages.find((m) => m.role === "system");
    return sys ? sys.content : "";
  },

  getUserMessages: function (messages) {
    if (!Array.isArray(messages)) return [];
    return messages.filter((m) => m.role === "user" || m.role === "assistant");
  },

  goBack: function () {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: "/pages/task/list/index" });
    }
  },

  onCopyChatContent: function (e) {
    this.copyResponseText(e);
  },

  onToggleChatExpand: function (e) {
    this.toggleLogExpand(e);
  },

  parseWorkflowSteps: function (taskInfo, logs) {
    if (taskInfo.task_type !== "WORKFLOW_EXECUTION") {
      this.setData({ workflowSteps: [] });
      return;
    }

    const payload = taskInfo.payload || {};
    const stepsMap = payload.steps || {};

    if (Object.keys(stepsMap).length === 0) return;

    // 保留完整的拓扑属性，提供给拓扑图和卡片渲染
    const steps = Object.keys(stepsMap).map(id => {
      const s = stepsMap[id];
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        nextStepId: s.nextStepId || "",
        branches: s.branches || [],
        defaultNextStepId: s.defaultNextStepId || "",
        status: "pending",
        branchResult: ""
      };
    });

    let runningIdx = -1;
    const activeEdges = new Set();
    let lastActiveStepId = "";

    logs.forEach(log => {
      const msg = log.message || "";
      if (msg.includes("[Step-START]")) {
        const startMatch = msg.match(/\[Step-START\] 执行步骤 (\d+):\s*(.+)/);
        if (startMatch) {
          const stepName = startMatch[2].trim();
          const target = steps.find(s => s.name === stepName);
          if (target) {
            target.status = "running";

            // 记录节点之间的激活转移边
            if (lastActiveStepId && lastActiveStepId !== target.id) {
              activeEdges.add(`${lastActiveStepId}->${target.id}`);
            }
            lastActiveStepId = target.id;
          }
          runningIdx = steps.findIndex(s => s.name === stepName);
        }
      } else if (msg.includes("[Step-SUCCESS]")) {
        if (runningIdx !== -1 && steps[runningIdx]) {
          steps[runningIdx].status = "success";
        }
      } else if (msg.includes("[Step-FAILED]")) {
        const failMatch = msg.match(/\[Step-FAILED\] 步骤 (.+) 执行出错/);
        if (failMatch) {
          const stepName = failMatch[1].trim();
          const target = steps.find(s => s.name === stepName);
          if (target) {
            target.status = "failed";
          }
        }
      } else if (msg.includes("[Step-BRANCH]")) {
        // 分支判定命中日志解析
        const branchMatch = msg.match(/\[Step-BRANCH\] 命中分支:\s*"(.+)"\s*->\s*跳转步骤 ID:\s*(.+)/);
        const defaultMatch = msg.match(/\[Step-BRANCH\] 未匹配到任何分支.*->\s*跳转步骤 ID:\s*(.+)/);
        
        if (branchMatch && runningIdx !== -1 && steps[runningIdx]) {
          const matchedLabel = branchMatch[1].trim();
          const targetStepId = branchMatch[2].trim();
          steps[runningIdx].branchResult = `命中分支: ${matchedLabel}`;
          
          if (lastActiveStepId) {
            activeEdges.add(`${lastActiveStepId}->${targetStepId}`);
          }
          lastActiveStepId = targetStepId;
        } else if (defaultMatch && runningIdx !== -1 && steps[runningIdx]) {
          const targetStepId = defaultMatch[1].trim();
          steps[runningIdx].branchResult = `走默认兜底路径`;
          
          if (lastActiveStepId) {
            activeEdges.add(`${lastActiveStepId}->${targetStepId}`);
          }
          lastActiveStepId = targetStepId;
        }
      }
    });

    this.setData({ 
      workflowSteps: steps,
      activeEdges: Array.from(activeEdges)
    }, () => {
      // 触发拓扑流程图重绘
      this.drawFlowChart();
    });
  },

  drawFlowChart: function () {
    const query = wx.createSelectorQuery().in(this);
    query.select('#detailFlowCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;

        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;

        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);

        const width = res[0].width;
        const height = res[0].height;

        ctx.clearRect(0, 0, width, height);

        const list = this.data.workflowSteps || [];
        if (list.length === 0) return;

        const activeEdges = new Set(this.data.activeEdges || []);

        const stepsMap = {};
        list.forEach(s => { stepsMap[s.id] = s; });

        const firstStepId = list[0].id;
        const levels = {};
        const visited = new Set();
        const queue = [{ id: firstStepId, lv: 0 }];

        while (queue.length > 0) {
          const curr = queue.shift();
          if (visited.has(curr.id)) continue;
          visited.add(curr.id);
          levels[curr.id] = Math.max(levels[curr.id] || 0, curr.lv);

          const stepObj = stepsMap[curr.id];
          if (stepObj) {
            if (stepObj.type === 'condition') {
              const branches = stepObj.branches || [];
              branches.forEach(b => {
                if (b.nextStepId && stepsMap[b.nextStepId]) {
                  queue.push({ id: b.nextStepId, lv: curr.lv + 1 });
                }
              });
              if (stepObj.defaultNextStepId && stepsMap[stepObj.defaultNextStepId]) {
                queue.push({ id: stepObj.defaultNextStepId, lv: curr.lv + 1 });
              }
            } else {
              if (stepObj.nextStepId && stepsMap[stepObj.nextStepId]) {
                queue.push({ id: stepObj.nextStepId, lv: curr.lv + 1 });
              }
            }
          }
        }

        let maxLv = 0;
        Object.keys(levels).forEach(id => {
          if (levels[id] > maxLv) maxLv = levels[id];
        });

        list.forEach(s => {
          if (levels[s.id] === undefined) {
            levels[s.id] = maxLv + 1;
          }
        });

        maxLv = 0;
        list.forEach(s => {
          if (levels[s.id] > maxLv) maxLv = levels[s.id];
        });

        const levelGroups = [];
        for (let i = 0; i <= maxLv; i++) {
          levelGroups.push([]);
        }
        list.forEach(s => {
          const lv = levels[s.id];
          levelGroups[lv].push(s.id);
        });

        const nodeCoords = {};
        const nodeW = 100;
        const nodeH = 34;
        const yGap = 72;
        const xGap = 110;
        const topPadding = 30;

        levelGroups.forEach((groupIds, lv) => {
          const count = groupIds.length;
          const y = topPadding + lv * yGap;
          groupIds.forEach((id, idx) => {
            const x = (width / 2) + (idx - (count - 1) / 2) * xGap - (nodeW / 2);
            nodeCoords[id] = { x, y, w: nodeW, h: nodeH };
          });
        });

        ctx.lineWidth = 1.5;
        list.forEach(step => {
          const fromCoord = nodeCoords[step.id];
          if (!fromCoord) return;

          const drawArrow = (fromX, fromY, toX, toY, color, isHighlight) => {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = isHighlight ? 1.8 : 1.0;
            
            const midY = (fromY + toY) / 2;
            ctx.moveTo(fromX, fromY);
            ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - 4, toY - 6);
            ctx.lineTo(toX + 4, toY - 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          };

          const drawBubble = (txt, x, y, color, isHighlight) => {
            ctx.save();
            ctx.font = '8px Outfit, sans-serif';
            const textWidth = ctx.measureText(txt).width || 20;
            const bw = textWidth + 8;
            const bh = 14;
            const bx = x - bw / 2;
            const by = y - bh / 2;

            ctx.fillStyle = isHighlight ? 'rgba(45, 42, 36, 0.95)' : 'rgba(30, 30, 30, 0.6)';
            ctx.strokeStyle = color;
            ctx.lineWidth = isHighlight ? 0.8 : 0.5;
            ctx.beginPath();
            ctx.moveTo(bx + 3, by);
            ctx.lineTo(bx + bw - 3, by);
            ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 3);
            ctx.lineTo(bx + bw, by + bh - 3);
            ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 3, by + bh);
            ctx.lineTo(bx + 3, by + bh);
            ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 3);
            ctx.lineTo(bx, by + 3);
            ctx.quadraticCurveTo(bx, by, bx + 3, by);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isHighlight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, x, y + 0.5);
            ctx.restore();
          };

          // 亮色/暗色主题判定
          const isLight = this.data.theme === 'theme-light';
          const passiveColor = isLight ? '#DCDCDC' : 'rgba(255, 255, 255, 0.15)';

          if (step.type === 'condition') {
            const branches = step.branches || [];
            branches.forEach(b => {
              if (b.nextStepId && nodeCoords[b.nextStepId]) {
                const toCoord = nodeCoords[b.nextStepId];
                const fromX = fromCoord.x + fromCoord.w / 2;
                const fromY = fromCoord.y + fromCoord.h;
                const toX = toCoord.x + toCoord.w / 2;
                const toY = toCoord.y;
                
                const edgeKey = `${step.id}->${b.nextStepId}`;
                const isHighlight = activeEdges.has(edgeKey);
                const color = isHighlight ? '#4CAF50' : passiveColor;

                drawArrow(fromX, fromY, toX, toY, color, isHighlight);
                
                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2;
                drawBubble(b.matchValue || b.label, midX, midY, color, isHighlight);
              }
            });
            if (step.defaultNextStepId && nodeCoords[step.defaultNextStepId]) {
              const toCoord = nodeCoords[step.defaultNextStepId];
              const fromX = fromCoord.x + fromCoord.w / 2;
              const fromY = fromCoord.y + fromCoord.h;
              const toX = toCoord.x + toCoord.w / 2;
              const toY = toCoord.y;

              const edgeKey = `${step.id}->${step.defaultNextStepId}`;
              const isHighlight = activeEdges.has(edgeKey);
              const color = isHighlight ? '#4CAF50' : passiveColor;

              drawArrow(fromX, fromY, toX, toY, color, isHighlight);
              
              const midX = (fromX + toX) / 2;
              const midY = (fromY + toY) / 2;
              drawBubble('default', midX, midY, color, isHighlight);
            }
          } else {
            if (step.nextStepId && nodeCoords[step.nextStepId]) {
              const toCoord = nodeCoords[step.nextStepId];
              const edgeKey = `${step.id}->${step.nextStepId}`;
              const isHighlight = activeEdges.has(edgeKey);
              const color = isHighlight ? '#4CAF50' : passiveColor;

              drawArrow(
                fromCoord.x + fromCoord.w / 2,
                fromCoord.y + fromCoord.h,
                toCoord.x + toCoord.w / 2,
                toCoord.y,
                color,
                isHighlight
              );
            }
          }
        });

        // 绘制节点边框和文字
        list.forEach((step, idx) => {
          const coord = nodeCoords[step.id];
          if (!coord) return;

          ctx.save();
          ctx.beginPath();
          const r = 6;
          const { x, y, w, h } = coord;
          
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();

          ctx.fillStyle = 'rgba(45, 42, 36, 0.95)';
          ctx.fill();

          // 状态化高亮决定边框色与线宽
          let borderW = 1.0;
          let borderC = '#7A726A'; // 默认 pending

          if (step.status === 'success') {
            borderW = 1.5;
            borderC = '#4CAF50';
          } else if (step.status === 'failed') {
            borderW = 1.5;
            borderC = '#FF5252';
          } else if (step.status === 'running') {
            borderW = 2.5;
            borderC = '#FF6B6B';
          }

          ctx.lineWidth = borderW;
          ctx.strokeStyle = borderC;
          ctx.stroke();

          ctx.font = 'bold 9px Outfit, sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const indexLabel = `[${idx + 1}] `;
          const stepName = step.name || '步骤';
          const truncatedName = stepName.length > 7 ? stepName.slice(0, 6) + '..' : stepName;
          
          ctx.fillText(indexLabel + truncatedName, x + w / 2, y + h / 2);
          ctx.restore();
        });
      });
  },
});

