# 架构决策记录 (ADR) - 2026-06-16 智能体资产工作台 CRUD 扩展

## 1. 背景
用户需要对系统中的智能体进行更新和删除管理。现有系统只支持新增，缺乏 CRUD 完整闭环，且没有独立的管理工作台。

## 2. 决策与方案
- **后端**：在网关层新增 `PUT` 和 `DELETE` 接口，支持对自定义智能体的更新与下线操作。增加 `user_id` 和 `is_preset = 0` 的隔离过滤保护。
- **前端**：新增独立的智能体工作台路由 `/pages/agent/manager`，并在个人中心增加资产入口。支持列表展示、更新以及下线删除操作。

## 3. 具体设计
详细设计请参见 [implementation_plan.md](file:///Users/zhangjiahao/.gemini/antigravity-ide/brain/8952e850-72ed-49ce-b1bf-7658f9248041/implementation_plan.md)。
