# 闯关评测系统

## 概述

Quiz 系统是一个阶段式（Stage-based）评测引擎，用于知识评估和技能测试。系统包含关卡配置、自动评分、经验值/积分奖励和进度追踪功能。

## 核心概念

### Stage（关卡）

每个关卡是一组评测题目或任务的集合。关卡有：
- 唯一 ID 和名称
- 关联的 NPC 角色
- 通过阈值（默认 60%）
- 可选的问题列表

### 评分引擎

自动评分系统：
1. 接收用户提交的答案
2. 与标准答案对比
3. 计算得分和得分率
4. 判断是否通过（得分率 >= 阈值）
5. 记录闯关结果

### 奖励体系

通过关卡可获得：
- **经验值** — 升级所需，每个关卡通过奖励 20 EXP
- **积分** — 可消费资源，完成测评奖励 10 积分
- **纯计算奖励** — 5 积分（特殊模式）

### 进度追踪

系统追踪每个用户的闯关进度：
- 已完成的关卡
- 每个关卡的得分和通过状态
- 总计经验值

## 评价流程

```
1. 用户请求关卡列表
   │
2. 返回可用关卡和用户进度
   │
3. 用户进入关卡，开始答题
   │
4. 用户提交答案
   │
5. 评分引擎计算得分
   │
6. 判断是否通过
   │
7. 奖励经验值和积分
   │
8. 更新用户进度
```

## 常量配置

| 常量 | 值 | 说明 |
|------|-----|------|
| QUIZ_PASS_THRESHOLD | 0.6 | 通过阈值（60%） |
| EXP_STAGE_PASS | 20 | 通过关卡奖励经验值 |
| EXP_QUIZ_COMPLETE | 10 | 完成测评奖励经验 |
| EXP_QUIZ_CALCULATE | 5 | 纯计算模式奖励 |
| TEST_HISTORY_MAX_LIMIT | 200 | 历史记录最大返回条数 |

## 数据库表

### quiz_stages — 关卡配置

```
id: TEXT PK
name: TEXT NOT NULL
npc_id: TEXT
questions: TEXT (JSON)
pass_threshold: REAL DEFAULT 0.6
created_at: TEXT NOT NULL
```

### user_stage_progress — 用户闯关进度

```
user_id: TEXT PK FK→users.id
stage_id: TEXT PK FK→quiz_stages.id
npc_id: TEXT PK
score: INTEGER
passed: INTEGER DEFAULT 0
total: INTEGER NOT NULL
updated_at: TEXT NOT NULL
```

### test_history — 测评历史

```
id: TEXT PK
user_id: TEXT FK→users.id
stage_id: TEXT
score: INTEGER
total: INTEGER
passed: INTEGER
created_at: TEXT NOT NULL
```
