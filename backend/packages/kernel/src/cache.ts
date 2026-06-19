/**
 * CacheService — 分布式缓存服务
 *
 * 基于 Cloudflare KV 的缓存封装，提供：
 * - null 占位防缓存穿透 (Null placeholder anti-penetration)
 * - TTL Jitter 防缓存雪崩
 * - 自动序列化/反序列化
 * - 统一缓存键前缀管理
 *
 * DDD Shared Kernel：纯基础设施，不含任何业务知识。
 */

const NULL_PLACEHOLDER = '__NULL__';
const DEFAULT_TTL_SECONDS = 300;
const JITTER_MAX_MS = 30000;

function withJitter(ttl: number): number {
  return ttl + Math.floor(Math.random() * JITTER_MAX_MS / 1000);
}

export const CacheService = {
  /**
   * 读取缓存。返回 undefined 表示缓存未命中（缓存穿透保护）。
   */
  async get<T>(kv: KVNamespace, key: string): Promise<T | undefined> {
    try {
      const raw = await kv.get(key);
      if (raw === null) return undefined;
      const parsed = JSON.parse(raw) as { value: T; ttl?: number };
      if (parsed.value === (NULL_PLACEHOLDER as any)) return undefined;
      return parsed.value;
    } catch {
      return undefined;
    }
  },

  /**
   * 写入缓存。自动添加随机 TTL Jitter 防雪崩。
   */
  async set<T>(kv: KVNamespace, key: string, value: T, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    const payload = JSON.stringify({ value, ttl: ttlSeconds });
    const ttl = withJitter(ttlSeconds);
    await kv.put(key, payload, { expirationTtl: ttl });
  },

  /**
   * 写入空占位（缓存穿透防护）。
   */
  async setNull(kv: KVNamespace, key: string, ttlSeconds: number = 60): Promise<void> {
    const payload = JSON.stringify({ value: NULL_PLACEHOLDER });
    await kv.put(key, payload, { expirationTtl: ttlSeconds });
  },

  /**
   * 删除缓存键。
   */
  async delete(kv: KVNamespace, key: string): Promise<void> {
    try {
      await kv.delete(key);
    } catch {
      // 容错
    }
  },

  /**
   * 批量删除匹配前缀的缓存键（通过逐个删除）。
   * 注意：KV 不支持前缀批量删除，此方法仅供兼容。
   */
  async deleteByPrefix(kv: KVNamespace, prefix: string): Promise<void> {
    try {
      const keys = await kv.list({ prefix });
      for (const key of keys.keys) {
        await kv.delete(key.name).catch(() => {});
      }
    } catch {
      // 容错
    }
  },
};
