 # 企业级 UI 风格重构 — LLD
 
 ## 1. 架构定位
 
 | 维度 | 说明 |
 |---|---|
 | **所属模块** | 前端微信小程序 UI 层 |
 | **外部依赖** | TDesign Miniprogram 组件库、TD 图标库 |
 | **解耦方式** | CSS Custom Properties 全量替换，WXML 结构微调，JS 逻辑不变 |
 | **当前问题** | 像素风（星露谷色板 + 粗木框 + 直角 + 3D 阴影）与企业级定位矛盾 |
 
 核心原则：**只改表现层，不动逻辑层**。JS 业务逻辑、API 调用、页面生命周期全部保留。
 
 ## 2. 设计 Tokens（核心契约）
 
 ### 2.1 色板（替换原有星露谷棕褐色系 → 钉钉/飞书系蓝灰色调）
 
 | Token | 暗色值 | 亮色值 | 用途说明 |
 |---|---|---|---|
 | `--bg-root` | `#0D0D10` | `#F2F2F7` | 页面最底层背景 |
 | `--bg-surface` | `#1C1C1E` | `#FFFFFF` | 卡片/面板背景 |
 | `--bg-surface-hover` | `#2C2C2E` | `#F5F5F7` | 卡片悬浮态 |
 | `--bg-surface-active` | `#3A3A3C` | `#E8E8ED` | 卡片按压态 |
 | `--brand` | `#1E6FFF` | `#1E6FFF` | 主品牌色（钉钉蓝） |
 | `--brand-light` | `#4096FF` | `#4096FF` | 品牌辅色（hover 高亮） |
 | `--brand-subtle` | `rgba(30,111,255,0.10)` | `rgba(30,111,255,0.08)` | 品牌浅色背景 |
 | `--success` | `#34C759` | `#34C759` | 成功色 |
 | `--warning` | `#FF9500` | `#FF9500` | 警告色 |
 | `--danger` | `#FF3B30` | `#FF3B30` | 危险色 |
 | `--text-primary` | `#F5F5F7` | `#1C1C1E` | 主文字 |
 | `--text-secondary` | `#AEAEB2` | `#3C3C43` | 次级文字 |
 | `--text-muted` | `#636366` | `#8E8E93` | 辅助文字 |
 | `--border-subtle` | `#38383A` | `#D1D1D6` | 分割线/弱边框 |
 | `--border-default` | `#48484A` | `#C6C6C8` | 卡片/组件边框 |
 
 ### 2.2 圆角体系
 
 | Token | 值 | 用途 |
 |---|---|---|
 | `--radius-sm` | `8rpx` | 小标签、小图标 |
 | `--radius-md` | `12rpx` | 卡片、面板、按钮 |
 | `--radius-lg` | `16rpx` | 大卡片、弹窗 |
 | `--radius-full` | `999rpx` | 头像、胶囊、圆点 |
 
 ### 2.3 阴影体系
 
 | Token | 暗色 | 亮色 | 用途 |
 |---|---|---|---|
 | `--shadow-sm` | `0 2rpx 8rpx rgba(0,0,0,0.3)` | `0 1rpx 4rpx rgba(0,0,0,0.08)` | 弱浮层 |
 | `--shadow-md` | `0 4rpx 16rpx rgba(0,0,0,0.4)` | `0 4rpx 12rpx rgba(0,0,0,0.12)` | 卡片/弹窗 |
 | `--shadow-lg` | `0 8rpx 32rpx rgba(0,0,0,0.5)` | `0 8rpx 24rpx rgba(0,0,0,0.16)` | 模态/顶部 |
 
 ## 3. 组件改造清单
 
 ### 3.1 卡片（`<view class="card">`）
 **改造前**：`border: 6rpx solid #57371d; border-radius: 0; box-shadow: 0 4rpx 0 #3d2511`
 **改造后**：`border-radius: var(--radius-md); background: var(--bg-surface); border: 1rpx solid var(--border-default); box-shadow: var(--shadow-sm)`
 
 ### 3.2 主按钮（`btn-primary`）
 **改造前**：褐色粗木框 + 3D 像素阴影 + 金边装饰
 **改造后**：`background: var(--brand); color: #FFFFFF; border: none; border-radius: var(--radius-md); font-weight: 500; box-shadow: none`
 
 ### 3.3 次按钮（`btn-secondary`）
 **改造前**：羊皮纸色 + 褐色粗框 + 像素阴影
 **改造后**：`background: var(--bg-surface); color: var(--text-primary); border: 1rpx solid var(--border-default); border-radius: var(--radius-md); font-weight: 500`
 
 ### 3.4 标签/状态徽章（`tag` `pill-filter` `status-dot`）
 **改造前**：正方形直角 + 褐色边框 + 像素方块圆点
 **改造后**：圆角胶囊 + 无边框 + 渐变/实色圆点 + 透明背景
 
 ### 3.5 输入框（`input-field` `glass-textarea` `glass-input`）
 **改造前**：黄土色底 + 褐色边框 + 内凹阴影
 **改造后**：`background: var(--bg-surface); border: 1rpx solid var(--border-default); border-radius: var(--radius-md); box-shadow: none`
 
 ### 3.6 分割线（`separator`）
 **改造前**：褐色虚线 `border-top: 4rpx dashed #57371d`
 **改造后**：`border-top: 1rpx solid var(--border-subtle)`
 
 ### 3.7 骨架屏（`skeleton`）
 **改造前**：褐色闪动像素块
 **改造后**：浅灰色磨砂渐变呼吸动画
 
 ### 3.8 箭头图标（`arrow-right-ios`）
 **改造前**：褐色粗箭头
 **改造后**：灰色细箭头
 
 ## 4. 文件变更清单
 
 | 文件 | 操作 | 说明 |
 |---|---|---|
 | `frontend/app.wxss` | 重写 | 替换所有 CSS Custom Properties + 全局组件类 |
 | `pages/task/list/index.wxss` | 重写 | 适配新 token |
 | `pages/deploy/index.wxss` | 重写 | 适配新 token |
 | `pages/credits/index.wxss` | 重写 | 适配新 token |
 | `pages/profile/index.wxss` | 重写 | 适配新 token |
 | `pages/login/login.wxss` | 重写 | 适配新 token |
 | `pages/map/index/index.wxss` | 重写 | 去除像素风 UI 元素 |
 | `packageAdmin/agents/index.wxss` | 重写 | 适配新 token |
 | `packageAdmin/dashboard/index.wxss` | 重写 | 适配新 token |
 | `packageAdmin/tasks/index.wxss` | 重写 | 适配新 token |
 | `packageAdmin/users/index.wxss` | 重写 | 适配新 token |
 | `packageTask/detail/index.wxss` | 重写 | 适配新 token |
 | `packageTask/agent/manager/index.wxss` | 重写 | 适配新 token |
 | `components/cyber-modal/cyber-modal.wxss` | 重写 | 适配新 token |
 
 ## 5. 防御设计与异常兜底
 
 | 异常场景 | 兜底策略 | TraceID 记录点 |
 |---|---|---|
 | 主题切换后新类名未加载 | fallback 使用 `:root` 默认变量，保证基础可读性 | `app.js toggleTheme` |
 | 旧 class 名称遗留 | `.card-premium`, `.glass-*` 等旧类保留透明消除定义 | — |
 | 用户缓存旧主题色 | 清除 Storage `theme` 键，重新生成 | `app.js onLaunch` |
 
 ## 6. 执行拆解
 
 - [ ] 1. 重写 `app.wxss` — 设计 token、卡片、按钮、标签、输入框、骨架屏、空状态、工具类
 - [ ] 2. 任务列表页 — WXSS 重写
 - [ ] 3. 部署页 — WXSS 重写 + WXML glass- 类替换
 - [ ] 4. 积分页 — WXSS 重写
 - [ ] 5. 个人中心页 — WXSS 重写
 - [ ] 6. 登录页 — WXSS 重写
 - [ ] 7. 地图页 — 去除像素风 UI 元素
 - [ ] 8. 管理后台包 — 4 个页面 WXSS 适配
 - [ ] 9. 任务分包 — 2 个页面 WXSS 适配
 - [ ] 10. cyber-modal WXSS 适配
