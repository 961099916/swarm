/**
 * ErrorUtils — 统一错误处理工具
 *
 * DDD Shared Kernel：纯基础设施，不包含业务逻辑。
 * 用于在 catch 块中安全地获取错误消息和堆栈信息。
 */

/**
 * 从未知类型的错误对象中安全提取消息字符串
 */
export function getErrorMessage(error: unknown, fallback = "未知错误"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as Record<string, unknown>).message);
  }
  return fallback;
}

/**
 * 从未知类型的错误对象中安全提取堆栈信息
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  return undefined;
}

/**
 * 判断错误是否包含指定的子字符串（case-insensitive）
 */
export function errorIncludes(error: unknown, substr: string): boolean {
  const msg = getErrorMessage(error).toLowerCase();
  return msg.includes(substr.toLowerCase());
}
