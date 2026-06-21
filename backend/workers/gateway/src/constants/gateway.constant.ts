// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/gateway/src/constants/gateway.constant.ts

/**
 * 网关服务静态常量类
 * 限界上下文: @swarm/gateway
 */
export class GatewayConstants {
  /** 默认跨域允许的源 */
  public static readonly DEFAULT_ALLOWED_ORIGIN = "https://swarm-gateway.jiuxia.online";

  /** 请求头名称 */
  public static readonly HEADER_INTERNAL_KEY = "X-Internal-Key";
  public static readonly HEADER_TRACE_ID = "X-Trace-Id";
  public static readonly HEADER_USER_ID = "X-User-Id";
  public static readonly HEADER_USER_ROLE = "X-User-Role";
  public static readonly HEADER_AUTHORIZATION = "Authorization";

  /** Token 提取前缀 */
  public static readonly BEARER_PREFIX = "Bearer ";

  /** 服务间通信默认超时（毫秒） */
  public static readonly FORWARD_TIMEOUT_MS = 25000;

  /** 请求体最大允许字节数 (1MB) */
  public static readonly MAX_BODY_SIZE = 1 * 1024 * 1024;

  /** 速率限制相关 */
  public static readonly RATE_LIMIT_PREFIX = "rl:";
  public static readonly RATE_LIMIT_ERROR_CODE = 1050;
  public static readonly RATE_LIMIT_MAX_REQUESTS = 120;
  public static readonly RATE_LIMIT_WINDOW_SECONDS = 60;

  /** 鉴权缓存相关 */
  public static readonly AUTH_CACHE_PREFIX = "user:auth:";
  public static readonly AUTH_CACHE_EMPTY_TTL_SEC = 300;
  public static readonly AUTH_CACHE_NORMAL_TTL_SEC = 3600;

  /** 账号封禁标志 */
  public static readonly BANNED_STATUS_FLAG = 1;
}
