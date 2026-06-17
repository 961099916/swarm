# 架构决策记录 (ADR) - 网关层（gateway）全 Handler 阿里规约及大厂规范化重构

* 创建日期: 2026-06-16
* 状态: 已批准 (Approved)
* 作者: 首席全栈架构师

---

## 1. 架构定位
- **模块归属**: 后端 API 网关控制器层 (`backend/workers/gateway/src/handlers/`)。
- **重构对象**:
  - `handlers/auth.ts` (用户微信登录与注销)
  - `handlers/credits.ts` (邀请关系绑定与广告积分发分)
  - `handlers/tasks.ts` (任务生命周期管理与工作流驱动)
  - `handlers/user.ts` (用户资料查看)
- **解耦设计**:
  - **校验解耦**：使用 `ValidatorChain` 将复杂的业务前置条件（如余额、参数完整性）封装到具体的 `RequestValidator` 节点中。
  - **网络与数据库事务解耦**：将大段的批处理事务、微信 API 请求和 Workflow 服务通信抽取为独立的内部私有方法，主控制函数只保留高内聚的分发逻辑。
  - **响应解耦**：全量使用 `ResponseBuilder` 取代手写 Response。

---

## 2. 核心契约与校验链设计 (Validation Nodes)
在 `src/utils/validator.ts` 中新增以下校验节点：

```typescript
export class TaskTypeValidator implements RequestValidator<{ taskType: string }> {
  public validate(data: { taskType: string }): string | null {
    const validTypes = ["PRICE_MONITOR", "CONTENT_DAILY", "AGENT_ORCHESTRATION"];
    if (!data.taskType || !validTypes.includes(data.taskType)) {
      return "暂不支持该任务类型";
    }
    return null;
  }
}
```

---

## 3. 重构后的控制流转规划

### 3.1 `auth.ts` 微信登录控制流
- **重构流转**:
  1. 调用 `ValidatorChain` 校验 `code` 必填性。
  2. 调用私有方法 `fetchWxOpenId` 异步获取用户微信 `openId`。
  3. 查询数据库，如用户不存在，调用 `registerNewUser`（封装 batch 注册、奖励发放事务及邀请人异步积分赠送）。
  4. 如用户被封禁，返回 `ResponseBuilder.forbidden`。
  5. 如用户正常存在，调用 `updateUserInfo`。
  6. 调用 `generateUserToken` 签发 JWT。
  7. 通过 `ResponseBuilder.success` 返回登录 DTO。

### 3.2 `tasks.ts` 任务生命周期控制流
- **重构流转**:
  1. 校验入参 `taskType` 和 `payload` 合法性。
  2. 验证用户积分余额是否充足。
  3. 执行 `dbTransactionCreateTask` 批处理事务（扣分、建任务、记账、写初始日志）。
  4. 调用 `triggerWorkflowEngine` 触发工作流回写状态。
  5. 异常时自动标记失败并回写，均通过 `ResponseBuilder` 输出。

---

## 4. 防御设计
- **接口防抖与超时**：微信 HTTP 调用设置 10 秒超时并防异常逃逸。
- **并发扣减安全约束**：数据库余额非负 CHECK 约束保障扣减防刷，事务失败由控制器截获并优雅展示。
- **TraceID 链路追踪**：所有私有辅助函数显式透传 `traceId` 传参，保证日志流完整可追溯。
