// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/doc-consumer/src/constants/doc-consumer.constant.ts

/**
 * 文档处理消费者服务静态常量类
 * 限界上下文: @swarm/doc-consumer
 */
export class DocConsumerConstants {
  /** 默认最大重试次数 */
  public static readonly DEFAULT_MAX_RETRIES = 3;

  /** 重试延迟时间 (秒) */
  public static readonly RETRY_DELAY_SECONDS = 10;

  /** 嵌入生成批处理大小 */
  public static readonly EMBEDDING_BATCH_SIZE = 10;

  /** 默认嵌入模型 */
  public static readonly DEFAULT_EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5";
}
