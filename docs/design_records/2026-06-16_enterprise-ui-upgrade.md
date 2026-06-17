# Architecture Decision Record (ADR): Swarm 微信小程序企业级 UI 规范升级与主题切换修复

* **创建时间**：2026-06-16
* **状态**：已批准 (Approved)
* **参与者**：首席全栈架构师 & 极致代码洁癖者 (Antigravity), 开发者 (USER)

---

## 1. 上下文与挑战 (Context)
Swarm 小程序前端基于 UniApp 与 Vue3 架构开发。此前项目中：
1. 部分核心页面（详情页、管理后台等）未引入双主题切换系统，未与 `themeStore` 状态及 inline-style 的 CSS 变量映射集（`themeVarsStyle`）进行物理绑定。
2. 现有视觉样式在间距网格、圆角规格、交互点击态、按钮发光以及数据状态展示（如加载中和空状态）上存在不规范问题，属于“个人 Demo 级别”，缺乏企业级移动端产品的高级质感。

为了将项目升级为对标阿里 **Ant Design Mobile 5.0** 与腾讯 **TDesign Mobile** 风格的企业级界面，需在解决主题缺陷的同时进行整体 UI 的规范化重构。

---

## 2. 决策与架构设计 (Decision & Architecture)

### 2.1 主题穿透与解耦
* 采用**观察者模式**。在页面根节点动态绑定：
  ```html
  <view :class="[themeStore.themeClass]" :style="themeStore.themeVarsStyle">
  ```
  在小程序环境下穿透 Shadow Scope，完成 CSS 语义色彩变量的向下级层级分发。
* 样式中全面禁止魔法颜色值与魔法数字。

### 2.2 视觉排版格网与交互质感
* **间距步进网格**：强制以 `4px (8rpx)` 步进的系统变量（`$spacing-4`, `$spacing-8` 等）作为唯一的布局 Margin 与 Padding 基准。
* **物理手感**：所有交互微件加配 `scale(0.98)` 点击态和缓动贝塞尔曲线。
* **高对比度毛玻璃**：重新优化 `glass-card` 的高亮描边与阴影层级（Elevation 2），保证亮色主题与暗色主题的对比度和质感。
* **状态占位符升级**：剔除纯文字或简易 Unicode 图标加载，采用科技感的加载组件和精致空状态设计。

---

## 3. 防御与安全设计 (Defense Strategy)
1. **Fallback 降级**：本地主题状态损坏或非法时，默认使用系统外观配置，或强制降级至 `'dark'`。
2. **文本 contrast A11y 满足度**：在亮色模式下，使用高强度暗色灰度值，杜绝浅灰色在白色背景下的低易读性。
3. **安全区域适配**：采用 `env(safe-area-inset-bottom)` 全局底衬，适配各类异形屏。

---

## 4. 执行计划 (Execution Checklist)
详细步骤已在 [task.md](file:///Users/zhangjiahao/.gemini/antigravity-ide/brain/99c8704d-b8f3-4847-801e-d8b749a506ca/task.md) 中进行跟踪。
* 步骤一：完成 `detail.vue`、`dashboard.vue`、`tasks.vue`、`users.vue`、`agents.vue` 5 个页面的 `themeStore` 引入及根节点主题绑定。
* 步骤二：重构上述页面的排版间距、卡片圆角和输入框焦点态，适配大厂规范。
* 步骤三：重置并美化加载态与空数据状态。
* 步骤四：进行前端微信小程序构建与视觉走查。
