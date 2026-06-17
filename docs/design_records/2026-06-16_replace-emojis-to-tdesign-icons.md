# Architecture Decision Record (ADR) - 替换全栈 Emoji 图标为 TDesign 官方图标库

*   **状态**：已批准 (Approved)
*   **日期**：2026-06-16
*   **架构师**：首席全栈架构师 & 极致代码洁癖者

## 1. 上下文与背景
当前 Swarm 智能体编排与测评系统全栈项目在多处 UI（如小程序主包、分包界面、RPG 地图 HUD）和后端（系统预置智能体、默认头像）中硬编码使用了大量的普通 Emoji 字符（如 `🔍`, `📊`, `✉️`, `🤖`, `🕵️` 等）。虽然其开发便捷，但导致了系统界面视觉杂乱、风格难以统一，不符合企业级工程化的视觉设计标准。

为了提供更加一致、精美和符合企业级标准的视觉体验，我们决定彻底停用这些普通 Emoji 字符，改用腾讯官方的 **TDesign 微信小程序官方图标库**。

## 2. 详细设计与实现方案 (LLD)

### 2.1 架构定位与组件引入
在小程序 `frontend/app.json` 中配置 `usingComponents` 全局注册 `t-icon` 基础组件：
```json
"usingComponents": {
  "t-icon": "tdesign-miniprogram/icon/icon"
}
```
这样做能使整个小程序（包括各分包）无需单独按需引入即可直接在 WXML 中使用 `<t-icon>` 组件，优化包体积的同时极大地精简了修改工作量。

### 2.2 核心契约与图标映射表
我们将常用的 Emoji 字符统一映射至 TDesign 的内置官方矢量图标：

| 原始 Emoji | TDesign 图标 Name | 应用场景描述 |
| :--- | :--- | :--- |
| `🤖` | `service` | 默认机器人/智能体头像 |
| `🔍` | `search` | 网页采集专家头像、搜索按钮 |
| `📊` | `chart-bar` | 深度分析师头像、报表分析 |
| `✉️` | `mail` | 邮件通知官头像、邮件入口 |
| `🕵️` | `user` | 后端 API 默认侦探/智能体头像 |
| `📺` | `video` | 看板激励积分、视频播放 |
| `👥` | `usergroup` | 邀请好友、用户管理 |
| `📭` | `inbox` | 暂无流水记录空状态、无任务信箱 |
| `👤` | `user` | 智能体管理标题、用户详情 |
| `✏️` | `edit` | 昵称修改、编辑按钮 |
| `ℹ️` | `info-circle` | 关于我们、详情介绍 |
| `⚡` | `bolt` | 积分/算力余额 |
| `💎` | `crown` | VIP/特权相关 |
| `📤` | `upload` | 编排分布式智能体动作 |
| `🌓` | `contrast` | 界面暗色/亮色主题切换 |
| `👑` | `crown` | 管理员后台入口 |
| `✨` | `star` | 新功能推荐、精美高亮 |
| `🎒` | `folder` | RPG 个人属性与图鉴背包 |
| `🔇` | `sound-mute` | 地图音频静音设置 |
| `🔊` | `sound` | 地图音频播放状态 |
| `🎵` | `music` | 音频设置标题 |
| `📜` | `file-text` | 测评报告标题、心智图腾报告 |
| `🌟` | `star` | 心智经验等级、解析明细 |
| `📖` | `book` | 学徒之门 |
| `⌛` | `time` | 历史记录时间戳 |
| `🌀` | `transform` | 传送阵入口 |
| `✓` / `✔` | `check` | 成功/对题状态标记 |
| `✕` | `close` | 失败/错题状态标记 |

*   **[MODIFY] [gateway/src/handlers/agents.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/handlers/agents.ts)** 与 **[admin/src/handlers/agents.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/handlers/agents.ts)**：
    *   将新建及保存自定义智能体时的默认兜底 avatar 从 🕵️ 表情换为 `"user"`。

### 1.5 后端历史遗留 Bug 修复 (TypeScript)
*   **[MODIFY] [gateway/src/handlers/tasks.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/handlers/tasks.ts)**：
    *   修复了之前在合并冲突时被误删除截断的 `buildCreateTaskValidatorChain` 函数定义前部，彻底消除了 `TS1128` 编译错误。
*   **[MODIFY] [quiz/src/index.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/index.ts)**：
    *   引入缺失的共享业务常量（`QUIZ_PASS_THRESHOLD`, `EXP_STAGE_PASS`, `EXP_QUIZ_COMPLETE`, `EXP_QUIZ_CALCULATE`, `TEST_HISTORY_MAX_LIMIT`），并修正了 `result` 变量的 `ReturnType` 动态类型推导，解决了 `TS2304` 和 `TS2322` 错误。
*   **[MODIFY] [quiz/src/evaluator/mapConfigs.ts](file:///Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/evaluator/mapConfigs.ts)**：
    *   为 `LOBBY_MAP_CONFIG` 对象显式标注了 `MapConfig` 类型，确保其 `obstacles` 子对象能够正确识别 `activeUntilLevel` 属性，消除了 `TS2339` 错误。

## 2. 关键 Bug 修复与防御设计

1.  **修复原厂致命的 JS 别名覆盖 Bug**：
    *   在 `packageTask/agent/manager/index.js` 和 `packageAdmin/agents/index.js` 底部，发现原厂遗留的错误别名函数（如 `onSelectModel` 指向不存在的 `this.selectModel`），它们重写并覆盖了文件上方正确的事件处理器。
    *   **修复手段**：物理删除了损坏的覆盖代码，同时将 `onEditAgent` 和 `onSaveAgent` 别名分别正确映射到 `onOpenEditModal` 和 `handleSave/handleAdminSave` 核心方法。
2.  **加入脏数据头像防御过滤 (validateAvatar)**：
    *   考虑到数据库中存量的历史自定义智能体，其头像仍然可能以 emoji（如 `🤖`）的形式保存，如果直接在小程序端读取并送入 `<t-icon>` 会导致渲染白屏。
    *   **防御手段**：在 `manager/index.js`、`admin/agents/index.js` 以及 `deploy/index.js` 页面拉取列表后，通过 `validateAvatar` 函数对每个智能体的 `avatar` 进行正则表达式预检。一旦发现属于 emoji 表情字符，则自动重置并降级为官方 `service` / `user` 图标，完美实现数据容灾。
3.  **消除后端微服务全局编译报错**：
    *   **修复手段**：通过精确补齐被损毁的校验链函数声明、校正 `drizzle-orm` 与共享常量的导入、对地图配置大对象进行严谨的类型注解，彻底移除了 `gateway` 和 `quiz` Workers 中历史堆积的所有 TS 编译器阻断报错。

## 3. 验证情况
*   **类型安全预检 (Type-Check)**：
    *   后端运行 `npm run type-check`，所有工作区子模块（`admin`, `gateway`, `quiz`, `workflow`）均已**完全通过编译，零报错**。
*   **前端渲染审查**：
    *   微信小程序全局成功集成并渲染 `t-icon` 矢量组件，所有原有的 UI 界面 emoji 成功升级为具有极佳灰度质感的企业级图形。
*   **手动验证**：
    1. 重新部署并初始化本地 D1 数据库。
    2. 登录小程序，并依次切入：积分页面、任务大盘、智能体管理器、管理后台、以及 RPG 地图页面。
    3. 检查所有曾经包含 emoji 的部分，均渲染为极具质感的 TDesign SVG 官方图标。
    4. 新建或编辑一个智能体，头像设置为 `'search'`，确认回显和持久化正常。
