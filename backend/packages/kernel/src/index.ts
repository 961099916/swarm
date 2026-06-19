/**
 * @swarm/kernel — 限界上下文之间的共享内核
 *
 * DDD 原则：Shared Kernel 应保持极小，仅包含跨领域共享的基础设施和值类型。
 * 任何领域业务逻辑、领域常量、领域表定义都不应出现在这里。
 */

// ─── 基础设施 ───
export { TraceLogger } from "./logger";
export type { LogPayload, LogLevel } from "./logger";

export { CacheService } from "./cache";

export { startupSecurityCheck } from "./security";

// ─── 错误处理工具 ───
export { getErrorMessage, getErrorStack, errorIncludes } from "./error-utils";

// ─── 统一响应协议 ───
export { ApiRes } from "./api-response";
export { ErrorCode, errorCodeToHttpStatus } from "./error-code";
export type { ApiResult, Pagination } from "./api-result";
export { success, successWithPagination, error } from "./api-result";

// ─── 熔断器 ───
export { CircuitBreaker } from "./circuit-breaker";
export type { CircuitState, CircuitConfig } from "./circuit-breaker";

// ─── 旧接口兼容（已弃用） ───
/** @deprecated 请使用 ApiResult / ApiRes 替代 */
export type ApiResponse<T = unknown> = import("./api-result").ApiResult<T>;

// ─── 网关路由 ───
export { ROUTE_TABLE, matchRoute } from "./route-registry";
export type { RouteEntry } from "./route-registry";
