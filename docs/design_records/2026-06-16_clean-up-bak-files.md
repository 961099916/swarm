# Architecture Decision Record (ADR)

## 清理前端冗余备份文件决策

- **日期**: 2026-06-16
- **状态**: 已批准 (Approved)
- **关联组件**: 前端工程结构净化 (Frontend Resources Optimization)
- **决策人**: Antigravity (首席全栈架构师)

---

### 1. 问题背景
在进行微信小程序端的前端页面重塑与样式重构期间，由于历史版本比对需求，在多个页面及分包目录下遗留了以 `.wxml.bak` 结尾的备份文件（共 10 个）。

由于微信小程序对主包及分包的上传体积有严格的限制（单包上限为 2MB），保留在源码目录下的无用文件不仅会增加小程序最终分包的构建体积，增大编译负担，还可能在热重载过程中因临时文件句柄冲突引发构建异常。

---

### 2. 决策与执行细节
我们决定对这些冗余文件进行物理清除，统一利用 Git 版本控制系统进行版本回溯，从工作区目录彻底排除垃圾残留。

#### 2.1 拟删除文件白名单
1. [mine/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/pages/mine/index.wxml.bak)
2. [credits/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/pages/credits/index.wxml.bak)
3. [deploy/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/pages/deploy/index.wxml.bak)
4. [task/list/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/pages/task/list/index.wxml.bak)
5. [agent/manager/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/packageTask/agent/manager/index.wxml.bak)
6. [users/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/packageAdmin/users/index.wxml.bak)
7. [tasks/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/packageAdmin/tasks/index.wxml.bak)
8. [agents/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/packageAdmin/agents/index.wxml.bak)
9. [dashboard/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/packageAdmin/dashboard/index.wxml.bak)
10. [map/index/index.wxml.bak](file:///Users/zhangjiahao/IdeaProjects/swarm/frontend/pages/map/index/index.wxml.bak)

#### 2.2 执行方式
使用精确的物理删除指令依次清理，防止破坏非 `.bak` 后缀的正常源文件。

---

### 3. 架构决定与影响
- **体积瘦身**: 剔除冗余文件后，小程序分包构建体积将得以缩减，有利于保障后续持续迭代的顺利发布。
- **免维护性**: 去除冗余备份有利于统一团队开发范式，彻底依赖 Git 进行追溯而避免“就地备份”恶习。
