// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/packages/shared/src/cache.ts

export class CacheService {
  /**
   * 写入缓存，支持空占位防穿透和 TTL 随机偏移防雪崩 (Jitter)
   * @param kv CACHE_KV 命名空间实例
   * @param key 缓存键
   * @param val 缓存值（为 null 表示数据库里查无此项，执行防穿透缓存）
   * @param ttlSeconds 基础过期时间（秒）
   */
  public static async set(kv: any, key: string, val: any, ttlSeconds: number): Promise<void> {
    if (!kv) return;

    // 数据包装，若是 null，写入特殊的防穿透占位符
    const payload = val === null ? { __null__: true } : val;

    // 加入 10% 上下的随机偏移时间 (Jitter) 消除缓存雪崩
    const deviation = Math.floor(Math.random() * (ttlSeconds * 0.1));
    const isPositive = Math.random() > 0.5;
    const finalTtl = Math.max(60, ttlSeconds + (isPositive ? deviation : -deviation));

    await kv.put(key, JSON.stringify(payload), { expirationTtl: finalTtl });
  }

  /**
   * 读取缓存，支持防空过滤
   * @returns undefined 表示未命中；null 表示空占位命中（数据库不存在该值）；T 表示命中正常值
   */
  public static async get<T>(kv: any, key: string): Promise<T | null | undefined> {
    if (!kv) return undefined;
    
    try {
      const raw = await kv.get(key);
      if (!raw) return undefined; // 未命中

      const parsed = JSON.parse(raw);
      if (parsed && parsed.__null__) {
        return null; // 占位命中，表示数据库确无此数据，防止缓存穿透
      }
      return parsed as T;
    } catch {
      return undefined; // 容错降级
    }
  }

  /**
   * 废弃或清除缓存（缓存双写失效）
   */
  public static async delete(kv: any, key: string): Promise<void> {
    if (!kv) return;
    try {
      await kv.delete(key);
    } catch {
      // 容错处理
    }
  }
}
