// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/constants/quiz.constant.ts

/**
 * 测评系统静态常量类
 * 限界上下文: @swarm/quiz
 */
export class QuizConstants {
  /** 缓存 TTL (秒) */
  public static readonly CACHE_NULL_TTL_SEC = 300;
  public static readonly CACHE_USER_QUIZ_TTL_SEC = 7200;

  /** 地图默认属性 */
  public static readonly LOBBY_DEFAULT_STAGE = "lobby";
  public static readonly FUN_LOBBY_STAGE = "fun_lobby";

  /** NPC 传送阵配置 */
  public static readonly PORTAL_STONE_NPC_ID = "portal_stone_exit";
  public static readonly PORTAL_STONE_NPC_NAME = "回大厅传送阵";
  public static readonly PORTAL_NPC_TYPE = "portal_exit";
  public static readonly PORTAL_DIALOGUE = "触摸传送阵，即可返回学堂大厅。";

  /** 测试类型 */
  public static readonly TEST_TYPE_STUDY = "STUDY";
}
