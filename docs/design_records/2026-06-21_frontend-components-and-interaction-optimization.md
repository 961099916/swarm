# 架构决策记录 (ADR) - Swarm 前端大厂级规范重构与组件抽取设计方案

## 1. 架构上下文与设计哲学

本方案旨在对微信小程序（`frontend/mini-program`）和后台管理端（`frontend/admin`）进行大厂级规范化组件抽取与交互逻辑优化，提升前端的可维护性、交互连贯性以及后端网络利用效率。

---

## 2. 详细重构设计

### 2.1 微信小程序端 (WeChat MiniProgram)

#### [NEW] [history-card](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/mini-program/components/history-card)
在 `frontend/mini-program/components` 下新建 `history-card` 自定义组件，用于统一渲染测评历史卡片：
- **契约入参**：
  - `historyId`: 历史报告 ID (String)
  - `testTitle`: 测验标题 (String)
  - `resultCode`: 测评代码如 INTJ (String)
  - `resultName`: 人格名称如“策划者” (String)
  - `formattedTime`: 格式化时间串 (String)
- **大厂交互动效**：
  - 卡片本体点击增加 `.card-actionable` 点击态微缩动效（`transform: scale(0.98)` 与 transition 配合）。
  - 对“删除”按钮包裹 `catchtap` 阻止事件冒泡，防止误触发查看详情。

#### [MODIFY] [mine/index.wxml](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/mini-program/pages/mine/index.wxml) & [mine/index.json](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/mini-program/pages/mine/index.json)
- 引入并使用 `components/history-card` 渲染列表卡片。
- 引入并使用 `components/empty-state` 替代手写的空状态节点。
- **交互逻辑优化**：
  - 用户点击删除历史时，拉起全局赛博确认弹窗 `cyber-modal`，告知不可逆风险，用户确认后再执行删除操作。

---

### 2.2 Admin 后台管理端 (Vue 3 / Element Plus)

#### [NEW] [SettingItem.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/components/SettingItem.vue)
在 `frontend/admin/src/components` 下新建通用参数配置项组件，用于消除 Settings 页面中大段重复的 `el-form-item` 及描述区 HTML：
- **契约入参**：
  - `label`: 参数大标题 (String)
  - `description`: 释义说明文本 (String)
  - `type`: 参数类型 (String: 'number'|'text')
  - `modelValue`: 绑定值 (Number|String)
  - `isDirty`: 是否已被修改但未保存 (Boolean, 脏检查)
- **双向绑定**：支持 `v-model`。
- **交互视觉**：若 `isDirty` 为真，则在标题右侧显示一个小蓝点或渐变 `未保存` 徽章，进行视觉警示。

#### [MODIFY] [settings/index.vue](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/views/settings/index.vue)
- 引入并使用 `SettingItem` 进行四大 Tab 标签页表单的扁平化重构，剔除冗余 HTML 结构。
- **全局状态机管理**：
  - 维护一份 `originalData` 配置快照，并在配置修改时进行比对，若与快照不同，则标记该 key 为 `dirty`。
  - 当检测到有任何一个 key 为 `dirty` 时，页面顶部展示流光通知栏 `“您有 X 项配置已修改但未保存，点击保存或放弃修改”`。
  - 保存按钮更新为 `批量提交修改`，一次性向后端推送所有变动的 key-value 键值对，避免多次 HTTP 并发请求。

---

### 2.3 后端 Admin 服务 (API Layer)

#### [MODIFY] [admin.controller.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/controllers/admin.controller.ts)
- 升级 `updateConfig` 控制器逻辑。使用 `zod.union` 支持对单条更新和 `{ configs: Array<{ key, value }> }` 批量配置格式的解析。
- 解析出批量数据后，在后台进行循环的 `ConfigService.set(db, key, value, kv)` 状态更新，记录所有被修改项的审计日志，实现高内聚的安全防腐。

---

## 3. 验证与走查计划 (Verification Plan)

### 3.1 静态检查与单元测试
- 运行 `pnpm -r run type-check` 对全部 packages 和 workers 进行严格 TypeScript 编译检查。
- 运行 `npm run test:kernel` 校验配置系统与缓存的隔离性能。

### 3.2 交互逻辑与 Payload 验证
- 改变 Settings 参数后，验证是否仅发起一笔 `PUT /api/v1/admin/configs` 批量提交请求。
- 走查小程序删除流程，校验 `cyber-modal` 赛博弹窗能否顺利拉起并实现删除。
