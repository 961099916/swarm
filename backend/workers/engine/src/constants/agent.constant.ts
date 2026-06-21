// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/constants/agent.constant.ts

/**
 * 智能体服务常量定义
 */
export class AgentConstants {
  /** 智能体列表缓存过期时间 (秒) */
  public static readonly LIST_CACHE_TTL = 7200;

  /** 默认智能体头像 */
  public static readonly DEFAULT_AVATAR = "user";

  /** 智能体列表缓存键名前缀 */
  public static readonly CACHE_KEY_PREFIX = "user:agents:list:";
}
