# 架构决策记录 (ADR) - 管理后台缓存一致性与极净化改造

## 1. 架构定位与上下文
在之前的微服务重构中，`gateway` 引入了对用户凭证和状态（包括角色 `role`、封禁状态 `isBanned`、Token版本 `tokenVersion`）的只读 KV 缓存（Key 格式为 `user:auth:{userId}`），以极大地释放高并发下的数据库 D1 读负载。
然而，当管理员在 `swarm-admin` 后台执行如下敏感写操作时，由于 KV 缓存未实时清除，将产生安全时间差（漏洞窗口）：
1. **强制下线** (`handleInvalidateUserToken`)：仅更新了 D1 中用户的 `tokenVersion`，未更新 KV，导致用户在缓存有效期（最长1小时）内依然能够通过鉴权。
2. **账号封禁** (`handleBanUser`)：仅更新了 D1 中用户的 `isBanned = 1`，未更新 KV，导致被封禁的用户依然可以继续请求业务接口。
3. **角色变更** (`handleUpdateUserRole`)：更新了用户的 `role` 和 `tokenVersion`，必须同步废弃缓存。

因此，本决策旨在实现后台写操作与网关 KV 缓存的强双写一致性失效删除逻辑。

---

## 2. 核心数据契约与缓存键
- **缓存媒介**：Cloudflare KV `CACHE_KV`
- **缓存键设计**：`user:auth:{userId}`
- **缓存值结构 (UserCachePayload)**:
  ```typescript
  interface UserCachePayload {
    tokenVersion: number;
    isBanned: number;
    role: string;
  }
  ```
- **同步删除原则**：在 `swarm-admin` 成功更新 D1 数据库相关记录后，同步调用 `CacheService.delete(CACHE_KV, "user:auth:" + userId)`。若 KV 操作抛出异常，需进行 Catch 容错降级，不应阻断后台核心业务逻辑事务。

---

## 3. 控制流转与安全预检
1. **启动预检 (startupSecurityCheck)**：
   管理后台作为核心内网服务，对 `INTERNAL_SECRET` 机密变量强依赖。需在启动时加入 Fail-Fast 预检，若为未配置状态，直接拦截并以 500 熔断。
2. **可观测性重构**：
   将原有的 `console.log`、`console.error` 等非结构化打印，全部替换为 `@swarm/shared` 中高内聚的 `TraceLogger` 结构化单行 JSON 日志。

---

## 4. 防御性设计
- **KV 容错**：`CacheService.delete` 自带 Catch 逻辑，防止 KV 服务临时抖动导致后台管理功能崩溃。
- **降级保护**：当 KV 缓存删除失败时，网关将在缓存自然过期后，或者依靠数据库校验拦截。同时，在 Trace 记录中输出 `WARN` 日志供追溯。

---

## 5. 执行计划 (Todo List)
1. **[MODIFY]** `admin/src/handlers/users.ts`：
   - 导入 `@swarm/shared` 的 `CacheService` 与 `TraceLogger`。
   - 重构 `handleUpdateUserRole`、`handleInvalidateUserToken`、`handleBanUser`，传入 `kv` 参数，在 Drizzle 操作成功后执行 `await CacheService.delete(kv, "user:auth:" + userId)`。
   - 使用 `TraceLogger` 打印结构化日志。
2. **[MODIFY]** `admin/src/handlers/admin.ts`：
   - 适配 `admin.ts` 导出/入口，引入 `CACHE_KV` 并传递给子 users handler。
3. **[MODIFY]** `admin/src/index.ts`：
   - 配置 `startupSecurityCheck` 预检 `INTERNAL_SECRET`。
   - 注入 `TraceLogger`，并从 `c.env` 提取 `CACHE_KV` 传给 users 处理器。
4. **[Verify]** 运行 `npm run type-check` 进行全面类型校验与编译。
