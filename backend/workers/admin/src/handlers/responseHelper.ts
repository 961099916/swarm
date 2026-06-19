/**
 * 管理后台响应辅助函数
 *
 * @deprecated 请直接使用 @swarm/kernel 中的 ApiRes。
 * 新代码应使用：
 *   import { ApiRes, ErrorCode } from "@swarm/kernel";
 *   return ApiRes.success(data, traceId);
 *   return ApiRes.error(ErrorCode.USER_NOT_FOUND, "用户不存在", traceId);
 */

import { ApiRes } from "@swarm/kernel";

/** @deprecated 使用 ApiRes.success() */
export function jsonSuccess<T>(data: T, traceId: string, _status = 200): Response {
  return ApiRes.success(data, traceId);
}

/** @deprecated 使用 ApiRes.error(code, message, traceId) */
export function jsonError(error: string, status: number, traceId: string): Response {
  const code = status === 400 ? 1000 : status === 403 ? 1020 : status === 404 ? 1030 : 1999;
  return ApiRes.error(code, error, traceId);
}
