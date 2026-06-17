<!-- File: /Users/zhangjiahao/IdeaProjects/swarm/docs/design_records/2026-06-16_tdesign-font-local-base64.md -->
# Architecture Decision Record (ADR) - 全站复古像素风升级与像素遮罩图标方案

*   **状态**：已批准 (Approved)
*   **日期**：2026-06-16
*   **架构师**：首席全栈架构师 & 极致代码洁癖者

## 1. 上下文与背景
在完成 Swarm 系统全栈 Emoji 替换后，小程序虽然通过本地化解决了网络加载错误。但用户提出新诉求，要求将小程序的整体视觉风格升级为 **16-bit 复古像素画风 (Pixel Art)**，与测评中的 Stardew Valley 经典像素地图风格保持完全一致，且全站图标也统一更换为像素风图标。

为了高保真地呈现像素风美学，并维护系统的包大小和代码整洁性，我们决定对小程序的全局设计体系以及图标系统进行重构。

## 2. 详细设计与重构方案 (LLD)

### 2.1 全局像素设计体系重写 (app.wxss)
在 [app.wxss](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/app.wxss) 中彻底废除原有的 Glassmor-fade 蓝灰管理色板，引入 Stardew Valley 风格的“星露谷木质画风”：
1.  **颜色重构**：亮色主题背景为金黄麦田泥土色 `#dfb180`，暗色背景为古木深褐色 `#2b1a0d`。卡片及文字容器一律为 `#f5e3ca` 羊皮纸色，搭配深褐原木文字 `#3d2511`。
2.  **核心卡片/面板 (.card)**：升级为粗褐色原木框 `border: 6rpx solid #57371d;`，搭配内层金线 `@after { border: 4rpx solid #d39c3f; }` 装饰，并加有 3D 像素立体重影 `box-shadow: 0 8rpx 0 #3d2511;`。
3.  **按钮/输入框 (.btn-primary, .input-field)**：主按钮及操作组件转变为木板样式，并添加 `:active { transform: translateY(4rpx); box-shadow: 0 4rpx 0 #3d2511; }` 按压物理位移动效，实现游戏控制器的操纵实感。

### 2.2 本地像素遮罩图标组件设计 (t-icon)
彻底弃用 WOFF 字体文件包（实现包大小 0 增量及 0 字体加载异常），改用 **CSS Mask + 像素风极简 SVG** 技术：
1.  **重定向接管**：在 `app.json` 中配置 `"t-icon": "/components/t-icon/icon"` 重新接管全局组件。
2.  **极轻量像素 SVG**：精选并手绘 31 个在用图标，用极少的 `<rect>` 像素色块绘制其 16x16 像素风 SVG 矢量轮廓。
3.  **CSS Mask 染色**：使用 CSS 的 `-webkit-mask-image` (遮罩) 加以图形裁剪，结合 `background-color: currentColor`，使像素图标能够像文字一样完美跟随 WXML 的 `color` 属性发生色彩改变，完全避免了传统图片无法改变前景色/着色困难的问题。

## 3. 防御设计
*   **兼容性前缀**：为 `-webkit-mask-image` 及相关属性补全前缀，确保在低版本 iOS/Android 的微信渲染沙箱上也能完美做遮罩匹配。
*   **缺失兜底**：若在用图标发生了拼写错误或不存在，默认通过 CSS 规则降级渲染为像素问号图标 `help-circle`。

## 4. 验证情况
1.  **清除缓存重新编译**：开发者工具 Console 无报错，Network 零网络字体下载。
2.  **视觉巡检**：全站卡片、输入框、按钮呈现出精致的 Stardew Valley 像素游戏质感，按钮按压反馈清晰。
3.  **图标表现**：所有图标全部变为精致可爱的 16x16 像素图案，配色在亮/暗色和不同页面中跟随 color 正常变化。
