// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/constants/user.constant.ts

/**
 * 用户服务静态常量类
 * 限界上下文: @swarm/user
 */
export class UserConstants {
  /** 默认昵称 */
  public static readonly DEFAULT_NICKNAME = "微信用户";

  /** 默认角色 */
  public static readonly ROLE_FREE_USER = "FREE_USER";

  /** 初始 Token 版本号 */
  public static readonly INITIAL_TOKEN_VERSION = 1;

  /** 初始封禁状态 (0: 正常) */
  public static readonly STATUS_NORMAL = 0;

  /** 封禁状态 (1: 封禁) */
  public static readonly STATUS_BANNED = 1;

  /** 鉴权缓存前缀与 TTL */
  public static readonly AUTH_CACHE_PREFIX = "user:auth:";
  public static readonly AUTH_CACHE_TTL_SEC = 3600;

  /** 头像上传限制 */
  public static readonly AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB
  public static readonly AVATAR_CONTENT_PNG = "image/png";
  public static readonly AVATAR_EXT_PNG = "png";
  public static readonly AVATAR_EXT_JPG = "jpg";
  public static readonly AVATAR_PATH_PREFIX = "/avatars/";

  /** 昵称校验限制 */
  public static readonly NICKNAME_MIN_LENGTH = 1;
  public static readonly NICKNAME_MAX_LENGTH = 30;

  /** 积分流水过滤类型 */
  public static readonly FLOW_TYPE_INCOME = "INCOME";
  public static readonly FLOW_TYPE_OUTCOME = "OUTCOME";
  public static readonly FLOW_TYPE_ALL = "ALL";
  public static readonly FLOW_MAX_LIMIT = 50;
  public static readonly FLOW_DEFAULT_LIMIT = 20;

  /** 微信登录授权 URL 前缀与参数 */
  public static readonly WX_API_URL_PREFIX = "https://api.weixin.qq.com/sns/jscode2session";
}
