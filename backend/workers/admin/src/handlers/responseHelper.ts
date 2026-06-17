
import { ApiResponse } from "@swarm/shared";

export function jsonSuccess<T>(data: T, traceId: string, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, traceId } as ApiResponse), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function jsonError(error: string, status: number, traceId: string): Response {
  return new Response(JSON.stringify({ success: false, error, traceId } as ApiResponse), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
