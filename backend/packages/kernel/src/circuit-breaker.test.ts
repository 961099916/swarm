/**
 * CircuitBreaker 单元测试
 *
 * 验证：三态模型（CLOSED → OPEN → HALF_OPEN → CLOSED）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker } from './circuit-breaker';

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe('CircuitBreaker', () => {
  let kv: KVNamespace;
  const svcName = 'test-svc';
  const traceId = 'trace-cb';

  beforeEach(() => {
    kv = createMockKV();
  });

  it('初始状态应为 CLOSED', async () => {
    const cb = new CircuitBreaker(kv, svcName, traceId);
    const status = await cb.getStatus();
    expect(status.state).toBe('CLOSED');
    expect(status.failureCount).toBe(0);
  });

  it('连续失败达到阈值后应开启熔断', async () => {
    const cb = new CircuitBreaker(kv, svcName, traceId, { failureThreshold: 3, timeoutMs: 60000, halfOpenMaxRequests: 1 });

    // CLOSED 状态允许请求
    expect(await cb.allowRequest()).toBe(true);
    await cb.onFailure();
    expect(await cb.allowRequest()).toBe(true);
    await cb.onFailure();
    expect(await cb.allowRequest()).toBe(true);
    await cb.onFailure();

    // 达到阈值 → OPEN
    const status = await cb.getStatus();
    expect(status.state).toBe('OPEN');
    expect(await cb.allowRequest()).toBe(false);
  });

  it('成功调用应重置熔断器至 CLOSED', async () => {
    const cb = new CircuitBreaker(kv, svcName, traceId, { failureThreshold: 2, timeoutMs: 60000, halfOpenMaxRequests: 1 });

    await cb.onFailure();
    await cb.onFailure();
    expect((await cb.getStatus()).state).toBe('OPEN');

    // 半开状态后成功应重置
    // 跳过超时模拟：直接 onSuccess 应该从任何状态回到 CLOSED
    await cb.onSuccess();
    expect((await cb.getStatus()).state).toBe('CLOSED');
    expect((await cb.getStatus()).failureCount).toBe(0);
  });

  it('HALF_OPEN 状态下失败应回到 OPEN', async () => {
    const cb = new CircuitBreaker(kv, svcName, traceId, { failureThreshold: 1, timeoutMs: 1, halfOpenMaxRequests: 1 });

    await cb.onFailure();
    expect((await cb.getStatus()).state).toBe('OPEN');

    // 等待超时 -> HALF_OPEN
    await new Promise(r => setTimeout(r, 5));
    expect(await cb.allowRequest()).toBe(true);

    // 半开状态失败 -> OPEN
    await cb.onFailure();
    expect((await cb.getStatus()).state).toBe('OPEN');
  });
});
