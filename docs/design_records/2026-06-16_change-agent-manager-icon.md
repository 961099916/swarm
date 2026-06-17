# Architecture Decision Record (ADR) - 更换自定义智能体工作台菜单图标

## 1. 背景与上下文

在 Swarm 微信小程序系统中，“我的”页面（个人中心）的“自定义智能体工作台”菜单项原使用 `t-icon-service`（像素机器人/客服齿轮图标）。
为更好地区分“系统智能体平台/管控大盘”与“客服/服务支持”概念，使用户能够通过更契合的视觉隐喻识别该入口，决定将该菜单图标更换为系统内已有的 `t-icon-control-platform`（像素控制大盘图标）。

---

## 2. 决策与设计方案

1. **更换图标 class 类名**：
   - 将 [profile/index.wxml](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/pages/profile/index.wxml) 中“自定义智能体工作台”菜单项的图标由 `t-icon-service` 修改为 `t-icon-control-platform`。
   
2. **样式契约复用**：
   - `control-platform` 已经在全局样式表 `static/styles/icon.wxss` 中定义，包含了完整的像素坐标与 base64 遮罩，不需要新增或修改任何全局样式定义。

---

## 3. 影响范围

- [profile/index.wxml](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/pages/profile/index.wxml)

---

## 4. 验证方式

- 重新编译并进行个人中心（我的）页面巡检，确认“自定义智能体工作台”菜单的图标展示为像素控制大盘，大小、色调与原像素风保持 100% 绝对一致。
