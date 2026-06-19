/**
 * ErrorCode — 统一业务错误码
 *
 * 设计原则（参考 Google API + Stripe + 微信支付规范）：
 * 0          = 成功
 * 1000-1999  = 通用错误（对应 HTTP 语义）
 * 2000-2999  = 各领域业务错误
 * 3000-3999  = 基础设施/第三方错误
 *
 * 前端只判断 code === 0 为成功，switch(code) 做错误处理。
 */

export const ErrorCode = {
  // ─── 成功 ───
  OK: 0,

  // ─── 通用错误 1000-1999 ───
  BAD_REQUEST: 1000,
  VALIDATION_ERROR: 1001,
  UNAUTHORIZED: 1010,
  TOKEN_EXPIRED: 1011,
  TOKEN_INVALID: 1012,
  FORBIDDEN: 1020,
  NOT_FOUND: 1030,
  CONFLICT: 1040,
  RATE_LIMITED: 1050,
  SERVICE_UNAVAILABLE: 1060,
  INTERNAL: 1999,

  // ─── 用户域 2000-2099 ───
  USER_NOT_FOUND: 2001,
  USER_BANNED: 2002,

  // ─── 积分域 2100-2199 ───
  INSUFFICIENT_CREDITS: 2100,
  AD_REWARD_DUPLICATE: 2101,
  INVITE_SELF: 2102,
  INVITE_ALREADY_BOUND: 2103,
  INVITE_INVALID: 2104,

  // ─── 智能体域 2200-2299 ───
  AGENT_NOT_FOUND: 2200,
  AGENT_PRESET_DELETE: 2201,

  // ─── 任务域 2300-2399 ───
  TASK_NOT_FOUND: 2300,
  TASK_FORBIDDEN: 2301,

  // ─── 知识库域 2400-2499 ───
  KB_NOT_FOUND: 2400,
  KB_FORBIDDEN: 2401,
  DOCUMENT_FAILED: 2402,

  // ─── AI 域 3000-3099 ───
  AI_MODEL_UNAVAILABLE: 3000,
  AI_RATE_LIMITED: 3001,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * 业务错误码 → HTTP 状态码映射
 * 前端无需关心 HTTP 状态，只认 code
 */
export function errorCodeToHttpStatus(code: number): number {
  if (code === 0) return 200;
  if (code < 1010) return 400;
  if (code <= 1012) return 401;
  if (code === 1020) return 403;
  if (code === 1030) return 404;
  if (code === 1040) return 409;
  if (code === 1050) return 429;
  if (code === 1060) return 503;
  return 500;
}
