# ADR: uni-ui 与 weapp-tailwindcss 双核 UI 架构整合决策

## 上下文
随着平台页面业务的发展，各组件自定义 Scoped CSS 代码剧增（如 `deploy/index.vue` 达 1150+ 行，其 CSS 占 600 行），违背了《阿里巴巴前端开发规约》的简洁规范。为了彻底缩减自定义 CSS 样式的行数，并保障极客质感与组件的跨端兼容性，决定引入大厂 UI 库与原子化 CSS。

## 决策
1. **引入双核体系**：
   - 引入 DCloud 官方 `@dcloudio/uni-ui` 库，采用 `easycom` 自动按需导入。利用官方组件（如 `uni-popup`、`uni-segmented-control`）直接承载弹窗、Tabs、输入等高交互节点，极大地精简 HTML 和动画 CSS。
   - 引入 `weapp-tailwindcss` 原力原子化 CSS。配置 PostCSS + Tailwind，挂接 Vite 编译插件，使开发者可以在 uniapp vue 页面里无心智负担地书写标准 TailwindCSS 类名，自动重写以兼容微信小程序，从而消除 90% 以上的自定义 CSS 声明。
2. **主题色深度对齐**：在 `tailwind.config.js` 中将常用的颜色和 8px 间距绑定到平台统一的 CSS 变量，确保一键切换亮暗色模式能实时、深度响应。

## 影响
- 自定义样式代码急剧减少，逻辑更易维护。
- 开发效率成倍提升。
