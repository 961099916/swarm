# Architecture Decision Record (ADR) - Swarm 前端亮色/暗色双主题切换系统与国民大厂扁平风格重构方案

## 1. 架构定位
- **模块归属**: 前端状态管理 (`frontend/src/stores/`)、全局样式系统 (`frontend/src/uni.scss` & `frontend/src/App.vue`)。
- **重构对象**:
  - `themeStore.ts`：新增主题状态存储，封装持久化与原生同步逻辑。
  - `uni.scss`：由静态常量配色 Token 重构为 CSS 变量（CSS Custom Properties）动态引用。
  - `App.vue`：声明全局 `.theme-dark` 与 `.theme-light` 的 CSS 变量定义，以及全局公共组件（按钮、输入框、状态微标等）的细微自适应。
  - 核心页面根容器：在所有主页面（`pages/index/index.vue`、`pages/login/login.vue` 等）最外层容器绑定 `:class="themeStore.theme"` 类名。
- **解耦设计**:
  - **样式解耦**：组件内的具体样式通过 Sass 变量引用，而 Sass 变量在编译期翻译为 CSS 变量（例如 `var(--bg-base)`）。这就实现了组件内部样式与运行时当前主题类的物理隔离与完美解耦。
  - **生命周期与状态解耦**：利用 Pinia 集中管理主题状态，各视图组件只需读取状态，无需关心持久化细节和底层原生的色彩同步命令。

---

## 2. 核心契约与设计规范

### 2.1 主题状态定义
在前端定义严格的主题类型契约：
```typescript
export type SwarmTheme = "light" | "dark";

export interface ThemeState {
  theme: SwarmTheme;
}
```

### 2.2 主题色值对比矩阵 (Design Tokens)

| Sass 变量名称 | 逻辑语义 | 暗色模式 (Dark Mode) | 亮色模式 (Light Mode) |
| :--- | :--- | :--- | :--- |
| `$bg-base` | 页面最底层底色 | `#0A0B0F` (极黑深空) | `#F4F6FA` (精致灰白，类似微信/支付宝底色) |
| `$bg-surface` | 卡片/面板层底色 | `#121319` (实色深炭) | `#FFFFFF` (纯白卡片) |
| `$bg-surface-hover` | 菜单项点击态底色 | `#1A1C24` | `#F0F2F5` |
| `$color-text-primary` | 一级正文/标题 | `rgba(255,255,255,0.9)` | `#1F1F1F` (高对比度深灰，保障极佳可读性) |
| `$color-text-secondary`| 二级说明/次要 | `rgba(255,255,255,0.6)` | `#5C5C5C` (中灰辅助文字) |
| `$color-text-muted` | 占位/失效文字 | `rgba(255,255,255,0.35)`| `#8C8C8C` |
| `$border-color-default`| 默认卡片边框/描边| `rgba(255,255,255,0.08)`| `#E8E8E8` (清爽细线边框) |
| `$border-color-subtle` | 极细分割线 | `rgba(255,255,255,0.05)`| `#F0F0F0` |
| `$shadow-sm` | 卡片微阴影 | `0 2rpx 8rpx rgba(0,0,0,0.15)` | `0 2rpx 8rpx rgba(0,0,0,0.04)` (柔和悬浮感) |
| `$color-brand-glass` | 品牌色辅助微透底色| `rgba(22,119,255,0.12)` | `rgba(22,119,255,0.06)` |
| `$color-brand-border` | 品牌色外边框 | `rgba(22,119,255,0.30)` | `rgba(22,119,255,0.15)` |

---

## 3. 控制流转规划

### 3.1 状态驱动与渲染控制流
```
User -> ThemeStore.toggleTheme -> 更新 state.theme -> 持久化存储 -> 同步微信原生 API (Bar & BG)
                                          |
                                          v
                                   页面根容器类绑定 -> CSS 变量生效
```

### 3.2 微信原生组件兜底流转
微信小程序在页面下拉回弹、顶部状态栏以及原生胶囊周围的底色均属于微信底层 WebView 范围，常规 CSS 变量无法控制。必须在主题更新后物理执行原生调用：
1. **下拉背景更新**:
   调用 `uni.setBackgroundColor` 动态变更下拉阻尼漏出的背景色，杜绝下拉“穿帮”现象。
2. **顶部导航栏更新**:
   根据主题动态指定 `frontColor`（只能是 `#ffffff` 或 `#000000`）和 `backgroundColor`，保证微信胶囊按钮的文字与背景对比度适中。

---

## 4. 防御与适配设计

- **防突变屏闪 (Flash Defense)**:
  若在页面渲染完毕后再去加载并应用主题，会导致界面从默认的暗色突变为亮色。
  *兜底策略*：在 `App.vue` 的 `onLaunch` 钩子中同步读取 LocalStorage 状态并激活 `initTheme()`，确保页面渲染第一帧前，全局 class 已经绑定完毕。
- **背景光晕弱化 (Glow Masking)**:
  登录页存在的背景渐变彩波光晕（`.glow-blob`）在暗色下很炫目，但在亮色白底上会显得十分刺眼和突兀。
  *兜底策略*：在亮色主题下，通过 `.theme-light .glow-blob { opacity: 0.04; filter: blur(160rpx); }` 强制弱化亮色光晕，营造雅致轻微的柔光感。
- **自定义 TabBar 自适应**:
  底部胶囊导航栏（`CustomTabBar`）在暗色下带有大角度毛玻璃高光，在亮色模式下极易过曝。
  *兜底策略*：将其背景色、边框及激活态投影全部绑定到 CSS 变量上，自动适应柔和白底与经典灰边。
