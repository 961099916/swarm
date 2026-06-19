/**
 * CacheService 单元测试
 *
 * 验证：缓存读写、Null 占位防穿透、TTL Jitter、删除操作
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheService } from './cache';

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async (options?: { prefix?: string }) => {
      const keys: { name: string }[] = [];
      for (const k of store.keys()) {
        if (!options?.prefix || k.startsWith(options.prefix)) {
          keys.push({ name: k });
        }
      }
      return { keys };
    }),
    // KVNamespace 要求的其他字段
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe('CacheService', () => {
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
  });

  describe('get', () => {
    it('缓存未命中应返回 undefined', async () => {
      const result = await CacheService.get(kv, 'missing-key');
      expect(result).toBeUndefined();
    });

    it('缓存命中应返回反序列化的值', async () => {
      await CacheService.set(kv, 'test-key', { name: 'test', count: 42 }, 300);
      const result = await CacheService.get<{ name: string; count: number }>(kv, 'test-key');
      expect(result).toEqual({ name: 'test', count: 42 });
    });
  });

  describe('Null 占位防穿透', () => {
    it('Null 占位应返回 undefined 而非 null', async () => {
      await CacheService.setNull(kv, 'null-key', 60);
      const result = await CacheService.get(kv, 'null-key');
      expect(result).toBeUndefined();
    });
  });

  describe('TTL Jitter', () => {
    it('set 应使用带抖动的 TTL', async () => {
      const putSpy = vi.spyOn(kv, 'put');
      await CacheService.set(kv, 'jitter-key', 'value', 100);
      expect(putSpy).toHaveBeenCalledTimes(1);
      const [, , options] = putSpy.mock.calls[0];
      const ttl = (options as { expirationTtl: number }).expirationTtl;
      // Jitter 在 100 ~ 130 之间
      expect(ttl).toBeGreaterThanOrEqual(100);
      expect(ttl).toBeLessThanOrEqual(130);
    });
  });

  describe('delete', () => {
    it('应删除已存在的缓存键', async () => {
      await CacheService.set(kv, 'del-key', 'value', 300);
      await CacheService.get(kv, 'del-key'); // 确保存在
      await CacheService.delete(kv, 'del-key');
      const result = await CacheService.get(kv, 'del-key');
      expect(result).toBeUndefined();
    });

    it('删除不存在的键不应抛异常', async () => {
      await expect(CacheService.delete(kv, 'nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('deleteByPrefix', () => {
    it('应删除匹配前缀的所有键', async () => {
      await CacheService.set(kv, 'prefix:a', 1, 300);
      await CacheService.set(kv, 'prefix:b', 2, 300);
      await CacheService.set(kv, 'other:c', 3, 300);

      await CacheService.deleteByPrefix(kv, 'prefix:');

      expect(await CacheService.get(kv, 'prefix:a')).toBeUndefined();
      expect(await CacheService.get(kv, 'prefix:b')).toBeUndefined();
      expect(await CacheService.get(kv, 'other:c')).toEqual(3);
    });
  });
});
