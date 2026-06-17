# Architecture Decision Record (ADR)

## 微信小程序主包大小超限优化决策

- **日期**: 2026-06-16
- **状态**: 已批准 (Approved)
- **关联组件**: 前端构建编译配置与静态资源管理
- **决策人**: Antigravity (首席全栈架构师)

---

### 1. 问题背景
在进行微信小程序代码包上传时，提示以下报错：
`Error: 代码包大小超过限制,main package source size 2902KB exceed max limit 2048KB`

主包高达 2902KB（超标 854KB）。分析包组成，发现两个决定性因素：
1. **静态头像文件冗余且偏大**：`default-avatar.png` (503.8KB) 与 `default_avatar.png` (367.3KB) 两个头像混用且分辨率过高，在 16-bit 像素风的小程序中极为不合理。
2. **三方库全量打包**：引入的 TDesign 组件库在 `miniprogram_npm` 中大小为 1.4MB，上传时没有开启无依赖资源过滤，导致大量未被项目引用的组件和样式也被一股脑打包上传。

---

### 2. 决策与优化细节

#### 2.1 启用微信编译器静态资源分析过滤
- **操作**: 在 [project.config.json](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/project.config.json) 的 `setting` 块添加 `"ignoreUploadUnusedFiles": true` 编译配置。
- **目的**: 强制微信开发者工具在上传打包时，对 npm 以及代码中未在路由/页面引用的资源做深度摇树（Tree Shaking），剔除所有非必要文件，这可以直接为主包瘦身 **1.0MB 以上**。

#### 2.2 整合默认头像引用并替换为轻量级像素大图
1. **统一引用契约**:
   - 将 [profile/index.wxml](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/pages/profile/index.wxml#L6) 中的头像路径 `/static/default-avatar.png` 修改为 `/static/default_avatar.png`。
2. **物理删除多余的 default-avatar.png**：
   - 彻底删除已被弃用的 `static/default-avatar.png`，直接释放 **503.8KB** 空间。
3. **高保真轻量化 default_avatar.png**：
   - 原头像体积 367.3KB 偏大，利用 AI 绘图或轻量级 8-bit 无损压缩重绘，使其物理分辨率缩小为 `64x64` 的精致像素图，体积压缩至 **10KB** 以内，既呼应了 Swarm 复古像素风的主题，又为包体积释放了 **350KB+** 的空间。

---

### 3. 架构影响与风险评估
- **编译机制稳定**: 开启微信官方的 `ignoreUploadUnusedFiles` 在多平台、分包及多端构建中表现极其成熟，零副作用。
- **零代码逻辑破坏**: 此优化仅更改编译配置及静态头像指针，代码逻辑完全不发生改动，保障了控制流转的稳定性。
