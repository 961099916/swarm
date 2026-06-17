
import { ApiResponse } from "@swarm/shared";

export class ResponseBuilder {
  private static readonly JSON_HEADER = { "Content-Type": "application/json" };

  public static success<T>(data: T, traceId: string, status = 200): Response {
    const body: ApiResponse<T> = {
      success: true,
      data,
      traceId
    };
    return new Response(JSON.stringify(body), {
      status,
      headers: this.JSON_HEADER
    });
  }

  public static error(errorMsg: string, traceId: string, status = 400): Response {
    const body: ApiResponse<null> = {
      success: false,
      error: errorMsg,
      traceId
    };
    return new Response(JSON.stringify(body), {
      status,
      headers: this.JSON_HEADER
    });
  }

  public static badRequest(errorMsg: string, traceId: string): Response {
    const badRequestStatus = 400;
    return this.error(errorMsg, traceId, badRequestStatus);
  }

  public static forbidden(errorMsg: string, traceId: string): Response {
    const forbiddenStatus = 403;
    return this.error(errorMsg, traceId, forbiddenStatus);
  }

  public static internalError(errorMsg: string, traceId: string): Response {
    const internalStatus = 500;
    return this.error(errorMsg, traceId, internalStatus);
  }
}
