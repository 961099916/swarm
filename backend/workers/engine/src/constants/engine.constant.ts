// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/engine/src/constants/engine.constant.ts

/**
 * EngineConstants — 引擎微服务常量中心
 * 
 * 按照阿里规范治理，避免任何硬编码值在业务和仓储层飘荡。
 */
export class EngineConstants {
  /** 任务默认划扣积分 */
  public static readonly TASK_COST = 10;

  /** 积分变动标识 */
  public static readonly REASON_TASK_COST = "TASK_COST";
  public static readonly REASON_ADMIN_ADJUST = "ADMIN_ADJUST";

  /** 任务状态 */
  public static readonly STATUS_PENDING = "PENDING";
  public static readonly STATUS_RUNNING = "RUNNING";
  public static readonly STATUS_FAILED = "FAILED";

  /** 日志级别 */
  public static readonly LOG_LEVEL_INFO = "INFO";
  public static readonly LOG_LEVEL_WARN = "WARN";
  public static readonly LOG_LEVEL_ERROR = "ERROR";
}
