/**
 * ApiResponseHelper — 统一 HTTP Response 构建器
 *
 * 所有 Worker 统一使用此工具构建响应，不再各自实现 ResponseBuilder。
 * 遵循统一的数据格式 { code, message, data, traceId, timestamp, pagination? }
 *
 * 使用方式：
 *   import { ApiRes } from "@swarm/kernel";
 *
 *   return ApiRes.success(data, traceId);
 *   return ApiRes.error(ErrorCode.NOT_FOUND, "用户不存在", traceId);
 *   return ApiRes.paginated(data, { page, pageSize, total }, traceId);
 */

import { ErrorCode, errorCodeToHttpStatus } from "./error-code";
import type { ApiResult, Pagination } from "./api-result";

const JSON_HEADER = { "Content-Type": "application/json" } as const;

function now(): string {
  return new Date().toISOString();
}

function json(body: ApiResult, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADER });
}

export const ApiRes = {
  // ─── 成功 ───

  success<T>(data: T, traceId: string, message = "ok"): Response {
    const body: ApiResult<T> = { code: 0, message, data, traceId, timestamp: now() };
    return json(body, 200);
  },

  paginated<T>(
    data: T,
    pagination: Pagination,
    traceId: string,
    message = "ok"
  ): Response {
    const body: ApiResult<T> = {
      code: 0, message, data, traceId,
      timestamp: now(), pagination,
    };
    return json(body, 200);
  },

  // ─── 错误（只需传 code + message，自动推导 HTTP status）───

  error(code: number, message: string, traceId: string): Response {
    const body: ApiResult<null> = { code, message, traceId, timestamp: now() };
    const httpStatus = errorCodeToHttpStatus(code);
    return json(body, httpStatus);
  },

  // ─── 常用便捷方法 ───

  badRequest(message: string, traceId: string): Response {
    return this.error(ErrorCode.BAD_REQUEST, message, traceId);
  },

  validationError(message: string, traceId: string): Response {
    return this.error(ErrorCode.VALIDATION_ERROR, message, traceId);
  },

  unauthorized(message = "请先登录", traceId: string = "SYSTEM"): Response {
    return this.error(ErrorCode.UNAUTHORIZED, message, traceId);
  },

  forbidden(message = "权限不足", traceId: string = "SYSTEM"): Response {
    return this.error(ErrorCode.FORBIDDEN, message, traceId);
  },

  notFound(message = "资源不存在", traceId: string = "SYSTEM"): Response {
    return this.error(ErrorCode.NOT_FOUND, message, traceId);
  },

  conflict(message: string, traceId: string): Response {
    return this.error(ErrorCode.CONFLICT, message, traceId);
  },

  rateLimited(message = "请求过于频繁，请稍后重试", traceId: string = "SYSTEM"): Response {
    return this.error(ErrorCode.RATE_LIMITED, message, traceId);
  },

  internalError(message = "系统繁忙，请联系系统管理员", traceId: string = "SYSTEM"): Response {
    return this.error(ErrorCode.INTERNAL, message, traceId);
  },

  serviceUnavailable(message = "服务暂不可用，请稍后再试", traceId: string = "SYSTEM"): Response {
    return this.error(ErrorCode.SERVICE_UNAVAILABLE, message, traceId);
  },
};
