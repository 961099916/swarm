# 架构决策记录 (ADR) - 鉴权中间件（authMiddleware.ts）及辅助层大厂规范化重构

* 创建日期: 2026-06-16
* 状态: 已批准 (Approved)
* 作者: 首席全栈架构师

---

## 1. 架构定位
- **模块归属**: 后端 API 网关公共过滤与辅助层 (`backend/workers/gateway/src/`)。
- **重构对象**:
  - `authMiddleware.ts` (鉴权拦截器)
  - `creditsHelper.ts` (积分变动助手)
- **解耦设计**:
  - **响应控制解耦**：拦截器中的所有 401、403、500 等异常返回，统一由 `ResponseBuilder` 门面接管，摒弃硬编码 JSON 输出。
  - **业务逻辑与事务解耦**：将大段的逻辑校验和数据库交互解耦为高内聚的私有方法。

---

## 2. 核心契约与接口

```typescript
export interface AuthResult {
  user?: UserRow;
  response?: Response;
}
```

---

## 3. 重构后的控制流转规划

### 3.1 `authMiddleware.ts` 鉴权控制流
- **重构流转**:
  1. 调用辅助函数 `extractBearerToken` 校验并提取 Authorization 标头。
  2. 调用 `verifyJWT` 进行解密。若无效，调用 `ResponseBuilder.error(..., 401)` 返回。
  3. 调用私有函数 `fetchUserById` 从 D1 数据库加载用户实体。若为空，返回 `401`。
  4. 调用私有函数 `validateUserAccess` 进行 `token_version` 和 `is_banned` 的安全性校验。若不符，返回对应的 `401` 或 `403`。
  5. 校验通过，直接返回 `{ user }`，由路由继续向下分发。

### 3.2 `creditsHelper.ts` 积分变动控制流
- **重构流转**:
  1. 调用 `queryCredits` 确认用户存在。
  2. 进行断言校验，计算最新积分余额。
  3. 调用 `executeCreditsBatch` 执行批量 batch 写入与 ledger 记录。

---

## 4. 防御设计
- **数据库鉴权降级**: 若 D1 在鉴权查询时崩溃，由 try-catch 拦截并利用 `ResponseBuilder.internalError` 返回 `500`。
- **防绕过与强制下线**: 在中间件强比对 `token_version`，保证递增 `token_version` 后以前所有签发的 Token 彻底失效。
