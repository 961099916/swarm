/**
 * ApiResult — 统一 API 响应体
 *
 * 参考规范：Google API Design Guide / Stripe / Microsoft REST
 * 前端通过 `res.code === 0` 判断成功，通过 `res.data` 获取数据。
 */

export interface Pagination {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总记录数 */
  total: number;
  /** 总页数 */
  totalPages: number;
}

export interface ApiResult<T = unknown> {
  /** 业务状态码 0=成功，非0=具体错误 */
  code: number;
  /** 人类可读的消息（成功时"ok"，失败时错误说明） */
  message: string;
  /** 响应数据（成功时携带） */
  data?: T;
  /** 全链路追踪 ID */
  traceId: string;
  /** 服务器时间戳 (ISO 8601) */
  timestamp: string;
  /** 分页元数据（列表接口携带） */
  pagination?: Pagination;
}

/**
 * 构建成功响应
 */
export function success<T>(data: T, traceId: string, message = "ok"): ApiResult<T> {
  return {
    code: 0,
    message,
    data,
    traceId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 构建带分页的成功响应
 */
export function successWithPagination<T>(
  data: T,
  traceId: string,
  pagination: Pagination,
  message = "ok"
): ApiResult<T> {
  return {
    code: 0,
    message,
    data,
    traceId,
    timestamp: new Date().toISOString(),
    pagination,
  };
}

/**
 * 构建错误响应
 */
export function error(
  code: number,
  message: string,
  traceId: string,
): ApiResult<null> {
  return {
    code,
    message,
    traceId,
    timestamp: new Date().toISOString(),
  };
}
