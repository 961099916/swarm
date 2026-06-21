// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/rag/src/constants/rag.constant.ts

/**
 * 检索增强 (RAG) 服务静态常量类
 * 限界上下文: @swarm/rag
 */
export class RagConstants {
  /** 默认知识库嵌入模型 */
  public static readonly DEFAULT_EMBEDDING_MODEL = "@cf/intfloat/multilingual-e5-base";

  /** 默认文档分块参数 */
  public static readonly DEFAULT_CHUNK_SIZE = 500;
  public static readonly DEFAULT_CHUNK_OVERLAP = 100;

  /** 分页与限制 */
  public static readonly DEFAULT_PAGE_LIMIT = 50;
  public static readonly DEFAULT_PAGE_OFFSET = 0;

  /** 文档状态 */
  public static readonly DOC_STATUS_PENDING = "PENDING";
  public static readonly DOC_STATUS_PROCESSING = "PROCESSING";
  public static readonly DOC_STATUS_READY = "READY";
  public static readonly DOC_STATUS_FAILED = "FAILED";

  /** 来源类型 */
  public static readonly SOURCE_UPLOAD = "UPLOAD";
  public static readonly SOURCE_WEB_SCRAPE = "WEB_SCRAPE";
  public static readonly SOURCE_MANUAL = "MANUAL";
}
