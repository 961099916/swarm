import { ApiRes } from "@swarm/kernel";

/**
 * ResponseBuilder — 统一响应构建器
 *
 * @deprecated 请直接使用 @swarm/kernel 中的 ApiRes。
 */
export class ResponseBuilder {
  /** @deprecated 使用 ApiRes.success() */
  public static success<T>(data: T, traceId: string, _status = 200): Response {
    return ApiRes.success(data, traceId);
  }

  /** @deprecated 使用 ApiRes.error(code, message, traceId) */
  public static error(errorMsg: string, traceId: string, status = 400): Response {
    const code = status === 403 ? 1020 : status === 404 ? 1030 : 1000;
    return ApiRes.error(code, errorMsg, traceId);
  }

  /** @deprecated 使用 ApiRes.badRequest() */
  public static badRequest(errorMsg: string, traceId: string): Response {
    return ApiRes.badRequest(errorMsg, traceId);
  }

  /** @deprecated 使用 ApiRes.notFound() */
  public static notFound(errorMsg: string, traceId: string): Response {
    return ApiRes.notFound(errorMsg, traceId);
  }

  /** @deprecated 使用 ApiRes.forbidden() */
  public static forbidden(errorMsg: string, traceId: string): Response {
    return ApiRes.forbidden(errorMsg, traceId);
  }

  /** @deprecated 使用 ApiRes.internalError() */
  public static internalError(errorMsg: string, traceId: string): Response {
    return ApiRes.internalError(errorMsg, traceId);
  }
}
