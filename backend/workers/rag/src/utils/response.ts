import { ApiResponse } from "@swarm/shared";

export class ResponseBuilder {
  private static readonly JSON_HEADER = { "Content-Type": "application/json" };

  public static success<T>(data: T, traceId: string, status = 200): Response {
    const body: ApiResponse<T> = { success: true, data, traceId };
    return new Response(JSON.stringify(body), { status, headers: this.JSON_HEADER });
  }

  public static error(errorMsg: string, traceId: string, status = 400): Response {
    const body: ApiResponse<null> = { success: false, error: errorMsg, traceId };
    return new Response(JSON.stringify(body), { status, headers: this.JSON_HEADER });
  }

  public static badRequest(errorMsg: string, traceId: string): Response {
    return this.error(errorMsg, traceId, 400);
  }

  public static notFound(errorMsg: string, traceId: string): Response {
    return this.error(errorMsg, traceId, 404);
  }

  public static forbidden(errorMsg: string, traceId: string): Response {
    return this.error(errorMsg, traceId, 403);
  }

  public static internalError(errorMsg: string, traceId: string): Response {
    return this.error(errorMsg, traceId, 500);
  }
}
