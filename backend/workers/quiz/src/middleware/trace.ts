import type { Context, Next } from 'hono';

export function traceMiddleware() {
  return async (c: Context, next: Next) => {
    const traceId = c.req.header('X-Trace-Id') || crypto.randomUUID();
    c.set('traceId', traceId);
    c.header('X-Trace-Id', traceId);
    await next();
  };
}
