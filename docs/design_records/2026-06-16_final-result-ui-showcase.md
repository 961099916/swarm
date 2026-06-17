# Architecture Decision Record (ADR) - 控制台终端最终协同成果独立展示区域

## 状态
已批准 (Approved)

## 日期
2026-06-16

## 1. 架构定位 (Architectural Position)

为了解决“多智能体最终协同产出成果混杂在终端滚动日志中、用户阅读困难”的痛点，本重构方案将为控制台终端页面 (`detail.vue`) 引入一个**物理独立的“最终成果展示看板”区域**。
- **定位**：位于头部状态看板与控制台黑客终端之间。
- **联动**：当任务执行状态为 `SUCCESS` 时，自动拉取数据库中的 `result_summary` 字段，以极富科技感的微绿拟物玻璃卡片予以独立渲染；若任务执行状态为 `FAILED`，则以微红渐变卡片渲染“异常终止报告”；若任务正在执行，该区域则自适应折叠隐藏，为日志终端留出充足视野。

---

## 2. 核心契约与数据交互 (Data Flow & Layout Contract)

### 2.1 数据拉取契约
直接使用已实现的网关 `GET /api/v1/tasks/list` 返回的 `result_summary` 和 `status` 进行渲染：
- 数据源：`taskInfo.result_summary` (String) 和 `taskInfo.status` (String)。
- 展现触发条件：`(taskInfo.result_summary && taskInfo.status === 'SUCCESS') || taskInfo.status === 'FAILED'`。

### 2.2 响应式 Flex 高度分配策略
为了防止展示看板将下方的黑客日志终端完全挤压出视口，本方案设定严格的高度契约：
- **报告卡片**：设置为 `flex-shrink: 0; max-height: 320rpx;`。内容超长时在卡片内部的 `scroll-view` 内进行垂直滚动。
- **终端区域**：保持 `flex: 1; min-height: 0;`。当成果报告卡片出现时，终端区域自动收缩并锁死高度；当报告卡片不出现时，终端区域自动延展填充整个屏幕中部。

---

## 3. 界面交互与视觉设计 (UI/UX & Visual Design)

### 3.1 卡片样式契约 (Visual System)
1. **成功态报告卡片 (`SUCCESS`)**：
   - 边框：`1px solid rgba(16, 185, 129, 0.2)`（墨绿微光）
   - 背景：`rgba(16, 185, 129, 0.04)`（微绿玻璃气泡）
   - 阴影：`0 8px 32px 0 rgba(0, 0, 0, 0.3)`
2. **失败态异常卡片 (`FAILED`)**：
   - 边框：`1px solid rgba(239, 68, 68, 0.2)`（猩红微光）
   - 背景：`rgba(239, 68, 68, 0.04)`（微红玻璃气泡）
3. **按钮交互**：
   - 卡片头部配有一键复制按钮，采用小胶囊样式设计，支持点击后的一键剪切板复制。

---

## 4. 模块修改明细 (Proposed Changes)

### 4.1 前端页面
#### [detail.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/src/pages/task/detail.vue)
- **Template 重构**：在 `.header-section` 的底部与 `.terminal-container` 的上方，新增 `.result-showcase-card` 结构。
- **Style 重构**：
  - 添加成果卡片的高级玻璃拟态样式（包含成功与失败主题）。
  - 微调滚动条间距与卡片阴影，确保在小程序及 H5 下视觉一致。
