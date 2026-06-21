// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/admin/src/constants/admin.constant.ts

/**
 * 管理后台服务静态常量类
 * 限界上下文: @swarm/admin
 */
export class AdminConstants {
  /** 审计日志操作类型 */
  public static readonly AUDIT_ACTION_UPDATE_ROLE = "UPDATE_ROLE";
  public static readonly AUDIT_ACTION_ADJUST_CREDITS = "ADJUST_CREDITS";
  public static readonly AUDIT_ACTION_BAN_USER = "BAN_USER";
  public static readonly AUDIT_ACTION_CANCEL_TASK = "CANCEL_TASK";
  public static readonly AUDIT_ACTION_UPDATE_AGENT = "UPDATE_AGENT";
  public static readonly AUDIT_ACTION_DELETE_AGENT = "DELETE_AGENT";
  public static readonly AUDIT_ACTION_CREATE_TOOL = "CREATE_TOOL";
  public static readonly AUDIT_ACTION_UPDATE_TOOL = "UPDATE_TOOL";
  public static readonly AUDIT_ACTION_DELETE_TOOL = "DELETE_TOOL";

  /** 分页默认配置 */
  public static readonly DEFAULT_PAGE_LIMIT = 50;
  public static readonly DEFAULT_PAGE_OFFSET = 0;

  /** 智能体默认图标 */
  public static readonly DEFAULT_AGENT_AVATAR = "service";

  /** 模型类型 */
  public static readonly MODEL_PURPOSE_CHAT = "CHAT";
  public static readonly MODEL_PURPOSE_EMBEDDING = "EMBEDDING";
}
