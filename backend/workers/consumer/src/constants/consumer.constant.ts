// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/consumer/src/constants/consumer.constant.ts

/**
 * 消费者服务静态常量类
 * 限界上下文: @swarm/consumer
 */
export class ConsumerConstants {
  /** 默认最大重试次数 */
  public static readonly DEFAULT_MAX_RETRIES = 3;

  /** 重试延迟时间 (秒) */
  public static readonly RETRY_DELAY_SECONDS = 10;
}
