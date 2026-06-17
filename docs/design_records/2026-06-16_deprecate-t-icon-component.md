<!-- File: docs/design_records/2026-06-16_deprecate-t-icon-component.md -->
# Architecture Decision Record (ADR) - 彻底废弃 t-icon 自定义组件与全面重塑为原生 view 像素遮罩图标

*   **状态**：已批准 (Approved)
*   **日期**：2026-06-16
*   **架构师**：首席全栈架构师 & 极致代码洁癖者

## 1. 上下文与背景
在实现了本地像素风 SVG 图标并在全局和各分包 JSON 中配置了代理 `t-icon` 路由后，系统在不同的小程序基础库版本以及异步分包预加载过程中，依然频繁面临分包页面全局组件解析路径失效而导致的图标白屏/渲染缺失等缺陷。

为了从根本上扫清由于第三方或自定义组件在分包树解析上的环境兼容阻碍，同时减少项目运行时的 JS 实例内存及 CPU 开销，我们决定**彻底废弃 `t-icon` 自定义组件**。

全站图标将彻底退化为微信原生最轻量的 `<view>` 标签，直接利用全局 CSS `-webkit-mask-image` 遮罩与 `background-color: currentColor;` 的染色继承机制在原生渲染层实例化图标。

## 2. 决策与详细方案
1.  **清理自定义组件**：
    *   物理删除 `/frontend/components/t-icon` 自定义组件目录，保持最干净、无冗余 JS/JSON 代码的项目结构。
    *   清理 `app.json` 以及所有分包（如 `packageTask`、`packageAdmin`）配置文件中的 `"t-icon": ...` 组件注册声明，回归零外部配置依赖。
2.  **样式全局收口**：
    *   新建 `frontend/static/styles/icon.wxss` 文件，用于集中存放 34 个图标的遮罩定义样式类。
    *   在全局 `app.wxss` 顶部加入 `@import "./static/styles/icon.wxss";` 进行全局引入，使任何页面、任何分包下的 WXML 节点无需任何 json 配置即可直接调用。
3.  **正则自动迁移**：
    *   编写 Python 迁移脚本，读取全站 WXML 模板文件，利用精准的正则捕获组将 `<t-icon name="xxx" size="36rpx" color="red" />` 标签无损映射替换为 `<view class="t-icon t-icon-xxx" style="font-size: 36rpx; color: red;"></view>`，保障原本的 class、style 和 bindtap 点击事件百分百完整迁移。

## 3. 影响与收益
*   **收益**：
    *   彻底消除了所有分包在任何小程序版本上由于组件作用域产生的图标展示 Bug。
    *   图标节点从 JS 组件实例退化为原生 CSS 渲染，页面性能显著提升。
    *   简化了新建智能体及各处的开发心智，使用图标如同写 HTML5 view 一样简单。
