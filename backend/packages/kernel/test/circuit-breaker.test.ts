/// <reference types="@cloudflare/workers-types" />
// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/packages/kernel/src/circuit-breaker.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../src/circuit-breaker';

interface CircuitRecord {
  service_name: string;
  state: CircuitState;
  failure_count: number;
  last_failure_time: number;
  last_state_change_time: number;
  half_open_attempts: number;
}

function createMockD1(): D1Database {
  const table = new Map<string, CircuitRecord>();

  return {
    prepare: vi.fn((sql: string) => {
      let boundParams: any[] = [];
      const stmt = {
        bind: vi.fn((...params: any[]) => {
          boundParams = params;
          return stmt;
        }),
        first: vi.fn(async () => {
          const serviceName = boundParams[0];
          const record = table.get(serviceName);
          return record || null;
        }),
        run: vi.fn(async () => {
          let changes = 0;
          const cleanSql = sql.replace(/\s+/g, ' ').trim();

          if (cleanSql.startsWith('INSERT OR IGNORE INTO circuit_breakers')) {
            const serviceName = boundParams[0];
            if (!table.has(serviceName)) {
              table.set(serviceName, {
                service_name: serviceName,
                state: 'CLOSED',
                failure_count: 0,
                last_failure_time: 0,
                last_state_change_time: 0,
                half_open_attempts: 0,
              });
              changes = 1;
            }
          } else if (cleanSql.startsWith("UPDATE circuit_breakers SET state = 'HALF_OPEN'")) {
            // UPDATE circuit_breakers SET state = 'HALF_OPEN', half_open_attempts = 1, last_state_change_time = ? WHERE service_name = ? AND state = 'OPEN' AND last_state_change_time = ?
            const [now, serviceName, lastStateChangeTime] = boundParams;
            const record = table.get(serviceName);
            if (record && record.state === 'OPEN' && record.last_state_change_time === lastStateChangeTime) {
              record.state = 'HALF_OPEN';
              record.half_open_attempts = 1;
              record.last_state_change_time = now;
              changes = 1;
            }
          } else if (cleanSql.startsWith("UPDATE circuit_breakers SET half_open_attempts = half_open_attempts + 1")) {
            // UPDATE circuit_breakers SET half_open_attempts = half_open_attempts + 1 WHERE service_name = ? AND state = 'HALF_OPEN' AND half_open_attempts < ?
            const [serviceName, maxRequests] = boundParams;
            const record = table.get(serviceName);
            if (record && record.state === 'HALF_OPEN' && record.half_open_attempts < maxRequests) {
              record.half_open_attempts++;
              changes = 1;
            }
          } else if (cleanSql.startsWith("UPDATE circuit_breakers SET state = 'CLOSED'")) {
            // UPDATE circuit_breakers SET state = 'CLOSED', failure_count = 0, half_open_attempts = 0, last_state_change_time = ? WHERE service_name = ?
            const [now, serviceName] = boundParams;
            const record = table.get(serviceName);
            if (record) {
              record.state = 'CLOSED';
              record.failure_count = 0;
              record.half_open_attempts = 0;
              record.last_state_change_time = now;
              changes = 1;
            }
          } else if (cleanSql.startsWith("UPDATE circuit_breakers SET state = 'OPEN'")) {
            // UPDATE circuit_breakers SET state = 'OPEN', last_state_change_time = ?, failure_count = failure_count + 1, last_failure_time = ?, half_open_attempts = 0 WHERE service_name = ?
            const [now1, now2, serviceName] = boundParams;
            const record = table.get(serviceName);
            if (record) {
              record.state = 'OPEN';
              record.last_state_change_time = now1;
              record.failure_count++;
              record.last_failure_time = now2;
              record.half_open_attempts = 0;
              changes = 1;
            }
          } else if (cleanSql.includes("state = CASE WHEN failure_count + 1 >= ?")) {
            // CLOSED 状态下的加 1 和判定
            const [lastFailureTime, threshold1, threshold2, stateChangeTime, serviceName] = boundParams;
            const record = table.get(serviceName);
            if (record && record.state === 'CLOSED') {
              record.failure_count++;
              record.last_failure_time = lastFailureTime;
              if (record.failure_count >= threshold1) {
                record.state = 'OPEN';
                record.last_state_change_time = stateChangeTime;
              }
              changes = 1;
            }
          } else if (cleanSql.includes("last_state_change_time = 0")) {
            // reset
            const serviceName = boundParams[0];
            const record = table.get(serviceName);
            if (record) {
              record.state = 'CLOSED';
              record.failure_count = 0;
              record.last_failure_time = 0;
              record.last_state_change_time = 0;
              record.half_open_attempts = 0;
              changes = 1;
            }
          }

          return { meta: { changes } };
        }),
      };
      return stmt as any;
    }),
  } as unknown as D1Database;
}

describe('CircuitBreaker', () => {
  let db: D1Database;
  const svcName = 'test-svc';
  const traceId = 'trace-cb';

  beforeEach(() => {
    db = createMockD1();
  });

  it('初始状态应为 CLOSED', async () => {
    const cb = new CircuitBreaker(db, svcName, traceId);
    const status = await cb.getStatus();
    expect(status.state).toBe('CLOSED');
    expect(status.failureCount).toBe(0);
  });

  it('连续失败达到阈值后应开启熔断', async () => {
    const cb = new CircuitBreaker(db, svcName, traceId, { failureThreshold: 3, timeoutMs: 60000, halfOpenMaxRequests: 1 });

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
    const cb = new CircuitBreaker(db, svcName, traceId, { failureThreshold: 2, timeoutMs: 60000, halfOpenMaxRequests: 1 });

    await cb.onFailure();
    await cb.onFailure();
    expect((await cb.getStatus()).state).toBe('OPEN');

    // 触发成功应重置
    await cb.onSuccess();
    expect((await cb.getStatus()).state).toBe('CLOSED');
    expect((await cb.getStatus()).failureCount).toBe(0);
  });

  it('HALF_OPEN 状态下失败应回到 OPEN', async () => {
    const cb = new CircuitBreaker(db, svcName, traceId, { failureThreshold: 1, timeoutMs: 1, halfOpenMaxRequests: 1 });

    await cb.onFailure();
    expect((await cb.getStatus()).state).toBe('OPEN');

    // 等待超时 -> HALF_OPEN
    await new Promise(r => setTimeout(r, 5));
    expect(await cb.allowRequest()).toBe(true);
    expect((await cb.getStatus()).state).toBe('HALF_OPEN');

    // 半开状态失败 -> OPEN
    await cb.onFailure();
    expect((await cb.getStatus()).state).toBe('OPEN');
  });
});
