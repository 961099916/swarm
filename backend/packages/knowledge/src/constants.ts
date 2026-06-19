/** 默认分块字符数 */
export const RAG_DEFAULT_CHUNK_SIZE = 500;

/** 默认分块重叠字符数 */
export const RAG_DEFAULT_CHUNK_OVERLAP = 100;

/** 默认检索 Top-K */
export const RAG_DEFAULT_TOP_K = 5;

/** 最低相似度阈值 */
export const RAG_DEFAULT_MIN_SCORE = 0.4;

/** 嵌入生成前缀（e5 模型要求）*/
export const RAG_EMBED_PASSAGE_PREFIX = "passage: ";
export const RAG_EMBED_QUERY_PREFIX = "query: ";

/** RAG 上下文注入最大字符数 */
export const RAG_MAX_CONTEXT_LENGTH = 3000;

/** 文档最大文件大小（字节） */
export const RAG_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 嵌入并发上限 */
export const RAG_MAX_CONCURRENT_EMBEDDINGS = 10;

/** 默认嵌入模型 */
export const DEFAULT_EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";
