/**
 * startupSecurityCheck — Fail-Fast 安全预检
 *
 * 在每个 Worker 启动的第一次请求时验证核心机密是否缺失。
 * DDD Shared Kernel：跨领域基础设施。
 */

import { TraceLogger } from "./logger";

export async function startupSecurityCheck(
  env: Record<string, any>,
  traceId: string,
  requiredSecrets: string[]
): Promise<Response | null> {
  for (const secret of requiredSecrets) {
    const value = env[secret];
    if (!value || value === '' || value.startsWith('YOUR_') || value === 'PLACEHOLDER') {
      TraceLogger.error(
        'SYSTEM',
        'SECURITY_CHECK_FAILED',
        traceId,
        `[FATAL] 安全预检失败：缺少关键机密配置 "${secret}"。请检查 wrangler.toml 或 Cloudflare Dashboard 的 Secret 配置。`
      );
      return new Response(
        JSON.stringify({ success: false, error: '服务配置异常，请联系系统管理员', traceId }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'X-Trace-Id': traceId } }
      );
    }
  }
  return null;
}
