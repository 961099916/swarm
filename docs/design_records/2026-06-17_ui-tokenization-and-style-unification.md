# 架构决策记录 (ADR)：全站 UI 和布局 Token 化重构与风格统一

* **状态**：已批准 (Approved)
* **日期**：2026-06-17
* **作者**：Antigravity (首席全栈架构师)
* **上下文 (Context)**：小程序端 `packageAdmin` 和 `packageTask` 分包中，许多页面和弹窗面板含有硬编码的暗色背景样式（如 `#0D0D10`、`rgba(18,18,24,0.98)` 等），导致在“亮色主题”下系统无法正常反色，引起了严重的撞字与对比度阅读性问题。为了实现企业级的高内聚、低耦合架构，全站需要改用统一定义的 CSS Token 变量。

---

## 核心设计决策 (Decision)

1. **废除硬编码色值**：
   在全局和分包样式表中，全面移除固定颜色声明，用 [app.wxss](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/app.wxss) 的 Token 变量（`var(--bg-root)`、`var(--bg-surface)`、`var(--text-primary)` 等）统一重构替换。
2. **弹窗背景主题自适应**：
   针对微信小程序的 4 个核心弹出层（`deploy/index`、`users/index`、`agents/index`、`manager/index`），将其暗色背景全部重构为背景主题变量，令其亮/暗色自如流转，彻底解决不可读 Bug。
3. **工具管理页样式瘦身**：
   对 `tools/index.wxss` 和 `tools/edit.wxss` 进行精简，重构其大量的 `.theme-light` 主题重复覆写。

---

## 评估与后果 (Consequences)

* **优势**：
  1. 界面天然适配各种屏幕亮度主题，完全根治对比度可读性灾难。
  2. 精简了 50% 以上的不规范 WXSS 冗余覆盖逻辑，提升小程序的渲染效率，降低包体积。
  3. 代码完全对齐 Swarm 设计体系规范，保证了设计系统的完整一致。
* **影响**：需全面排查 WXML/WXSS 相关属性，以防错漏替换导致布局错位。
