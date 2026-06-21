# 底层设计文档 (LLD) - 微信小程序 AI 对话 Markdown 渲染与交互体验优化设计

本方案设计了在微信小程序（`frontend/mini-program`）中，引入富文本渲染组件 `mp-html` 和 Markdown 编译器 `marked.js`，实现 AI 聊天气泡的 Markdown 解析渲染；并通过日志轮询（主对话 `pages/chat`）与知识库直接应答（`packageKnowledge/chat`）两种模式，结合“滚动锚定锁屏算法”与“输入框自适应过渡”，对标大厂级别 AI 对话的极致体验。

## 1. 架构定位
- **所属模块**: 微信小程序前端呈现与渲染层 (`frontend/mini-program/pages/chat` 与 `frontend/mini-program/packageKnowledge/chat`)。
- **外部依赖**:
  - 依赖本地拷贝的 `utils/marked.js` 实现纯 JS 端高效的 Markdown 文本编译。
  - 依赖本地自定义组件 `components/mp-html` 实现将编译后的 HTML 渲染为小程序原生高性能的富文本树。
  - 依赖网关路由 `/api/v1/tasks/logs` 以轮询拉取大模型与协同编排过程的日志，以及 `/api/v1/kb/search` 进行知识库快速检索。

---

## 2. 核心契约与数据模型 (Data Contracts)

### 2.1 升级后的前端聊天消息结构
前端 `messages` 数组中的各个消息对象需增加富文本渲染所必需的 `htmlContent` 字段，并携带相关交互状态：
```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;         // 原始文本 (包含 Markdown)
  htmlContent?: string;    // 由 marked 转换后的 HTML 字符串，用于 mp-html 渲染
  thinking?: boolean;      // 是否处于思考中 / 加载状态
  isSystem?: boolean;      // 是否为系统消息
  isError?: boolean;       // 是否为错误消息
  sources?: string[];      // 引用文档来源 (主要用于知识库)
}
```

---

## 3. 控制流转与算法设计 (Control Flow & Algorithms)

### 3.1 对话数据流控逻辑
1. **主对话页面 (`pages/chat`) 轮询日志流式化**:
   - 用户发送 Prompt -> 调用 `/api/v1/tasks/create` 异步创建任务并获取 `taskId`。
   - 前端新增 `assistant` 空白消息气泡，设置 `thinking: true`。
   - 每隔 1.5 秒轮询 `/api/v1/tasks/logs?taskId={taskId}`。
   - **日志内容过滤与拼接**: 
     - 对拉取到的日志按 `createdAt` 排序，如果发现日志以 `[AI_CHAT]` 开头，则截取其后面的 JSON 字符串，反序列化并提取其 `response` 作为助理的输出。
     - 若未拉取到 `[AI_CHAT]`，但轮询发现任务状态已为 `COMPLETED`，则通过 `resultSummary` 字段兜底作为最终回答。
     - 为了实现流畅的打字机流式效果，使用本地定时器以每 50ms 追加 1~2 个字符的速度，平滑地将提取出的文本追加至 `content` 中，并同步调用 `marked(content)` 编译为 `htmlContent`，`setData` 更新视图。
     - 轮询探测到任务状态为 `COMPLETED`、`FAILED` 或轮询达到上限次数（60 次，共 90 秒）时，清除定时器，标记输出完毕。
2. **知识库对话页面 (`packageKnowledge/chat`) 一次性 Markdown 渲染**:
   - 检索 `/api/v1/kb/search` 并由前端拼装好 Markdown 文本后，直接调用 `marked(answer)` 将内容转成 HTML 并一次性注入 `htmlContent` 以完成渲染。

### 3.2 滚动锚定与防抖算法 (Scroll Anchoring)
为防止 AI 在高频打字机输出时，页面强制拉底干扰用户手动翻看历史记录，引入滚动状态机：
- **状态变量**:
  - `autoScroll` (boolean): 是否允许自动滚动至底部。
  - `showNewMsgBadge` (boolean): 是否在右下角悬浮展示新消息球。
- **状态流转**:
  - 监听 `<scroll-view>` 的 `bindscroll` 事件，实时获取 `scrollTop`、`scrollHeight`、`clientHeight`。
  - 计算距离底部高度：`distanceToBottom = scrollHeight - scrollTop - clientHeight`。
  - **触底判定**: 当 `distanceToBottom < 50px` 时，认为用户处于底部，新文字到达时立即执行滚动底部的操作，且重置 `showNewMsgBadge = false`。
  - **锁屏判定**: 当用户手动向上滑动导致 `distanceToBottom >= 100px` 时，立即置 `autoScroll = false` 锁定屏幕滚动。
  - **新消息气泡提示**: 在 `autoScroll` 为 `false` 且 AI 仍在输出新字时，置 `showNewMsgBadge = true` 唤起悬浮球。点击悬浮球时，调用平滑滚动滚动到底部，并重新置 `autoScroll = true`。

### 3.3 极致 UI 细节设计
- **打字闪烁光标 (Blinking Cursor)**:
  - 处于 `thinking: true` 或者打字输出未完成的气泡，在其 `mp-html` 后面利用 WXML 挂载闪烁光标元素：
    ```css
    .typing-cursor {
      display: inline-block;
      width: 4rpx;
      height: 28rpx;
      background-color: var(--brand-color, #FF6B6B);
      margin-left: 8rpx;
      animation: blink 1s step-start infinite;
    }
    @keyframes blink {
      50% { opacity: 0; }
    }
    ```
- **输入框自适应顶起**:
  - 对输入框设置 `adjust-position="{{false}}"`，监听 `bindfocus` 得到键盘高度 `keyboardHeight`，动态给对话列表追加 `padding-bottom`，并在 `bindblur` 时清空，以消除软键盘弹出时的闪烁硬跳。

---

## 4. 防御与异常设计
1. **轮询超时熔断**: 为避免后端队列阻塞或任务中断导致小程序无限请求，设置最大轮询上限 60 次（约 90 秒），超时自动判定为任务失败并友好提示用户。
2. **空日志容错**: 对 `/api/v1/tasks/logs` 接口发生 500 等网络抖动错误时，不中断轮询，而是记录重试次数并在 3 次失败后抛出友好网络提示。
3. **Markdown 渲染防抖**: 限制编译更新频率，采用 `requestAnimationFrame` 级别防抖，避免因高频 setData 导致小程序 UI 线程死锁卡顿。

---

## 5. 执行拆解 (Todo List)

### Phase 1: 核心依赖引入与基础渲染改造
- [ ] 1. 在 `pages/chat/index.json` 和 `packageKnowledge/chat/index.json` 中，在 `usingComponents` 中注册自定义组件 `"mp-html": "../../components/mp-html/index"`。
- [ ] 2. 在 `pages/chat/index.wxml` 和 `packageKnowledge/chat/index.wxml` 中，修改 AI 回答的渲染方式，采用 `<mp-html content="{{item.htmlContent}}"></mp-html>`，并在输出中提供 `.typing-cursor` 动画。

### Phase 2: marked.js 编译与逻辑升级
- [ ] 3. 升级 `packageKnowledge/chat/index.js`，引入 `marked.js`，在检索出答案后转换成 HTML 赋给消息项。
- [ ] 4. 升级 `pages/chat/index.js`，引入 `marked.js`，重构 `onSend` 逻辑。

### Phase 3: 任务轮询与流式打字机效果模拟
- [ ] 5. 在 `pages/chat/index.js` 中编写任务轮询器与流式打字机文本填充定时器，实现顺滑打字效果。
- [ ] 6. 编写滚动锚定锁屏计算与右下角新消息悬浮球，支持点击一键滚回底部重新对齐。
- [ ] 7. 编写键盘聚焦过渡自适应逻辑。
- [ ] 8. 进行本地测试，确保编译包体积符合微信小程序限制。
