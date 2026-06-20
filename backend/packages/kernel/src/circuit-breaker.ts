/// <reference types="@cloudflare/workers-types" />
// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/packages/kernel/src/circuit-breaker.ts

import { TraceLogger } from "./logger";

export type CircuitState = "CLOSED" | "HALF_OPEN" | "OPEN";

export interface CircuitConfig {
  /** 熔断阈值：连续失败 N 次后开启（默认 5） */
  failureThreshold: number;
  /** 半开探针超时：OPEN 状态保持毫秒后进入 HALF_OPEN（默认 30000） */
  timeoutMs: number;
  /** 半开状态允许的探针请求数（默认 1） */
  halfOpenMaxRequests: number;
}

const DEFAULT_CONFIG: CircuitConfig = {
  failureThreshold: 5,
  timeoutMs: 30000,
  halfOpenMaxRequests: 1,
};

interface CircuitData {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  lastStateChangeTime: number;
  halfOpenAttempts: number;
}

export class CircuitBreaker {
  private config: CircuitConfig;

  constructor(
    private db: D1Database,
    private serviceName: string,
    private traceId: string,
    config?: Partial<CircuitConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化熔断器记录，若不存在则插入默认记录
   */
  private async ensureInitialized(): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT OR IGNORE INTO circuit_breakers 
           (service_name, state, failure_count, last_failure_time, last_state_change_time, half_open_attempts) 
           VALUES (?, 'CLOSED', 0, 0, 0, 0)`
        )
        .bind(this.serviceName)
        .run();
    } catch (err: unknown) {
      TraceLogger.warn("KERNEL", "CIRCUIT_INIT_FAILED", this.traceId, `初始化熔断器表记录异常，但不阻断业务: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 获取当前熔断数据，默认提供 CLOSED 的降级数据
   */
  private async getState(): Promise<CircuitData> {
    try {
      await this.ensureInitialized();
      const result = await this.db
        .prepare(`SELECT state, failure_count, last_failure_time, last_state_change_time, half_open_attempts FROM circuit_breakers WHERE service_name = ?`)
        .bind(this.serviceName)
        .first<any>();
      
      if (!result) {
        return { state: "CLOSED", failureCount: 0, lastFailureTime: 0, lastStateChangeTime: 0, halfOpenAttempts: 0 };
      }
      return {
        state: result.state as CircuitState,
        failureCount: result.failure_count || 0,
        lastFailureTime: result.last_failure_time || 0,
        lastStateChangeTime: result.last_state_change_time || 0,
        halfOpenAttempts: result.half_open_attempts || 0
      };
    } catch (err: unknown) {
      TraceLogger.error("KERNEL", "CIRCUIT_GET_STATE_FAILED", this.traceId, `读取熔断器状态异常，降级 CLOSED 放行`, err);
      return { state: "CLOSED", failureCount: 0, lastFailureTime: 0, lastStateChangeTime: 0, halfOpenAttempts: 0 };
    }
  }

  /**
   * 判断是否允许请求通过
   * 采用 CAS 与乐观锁原子更新实现，解决多节点并发探针泄漏问题
   */
  async allowRequest(): Promise<boolean> {
    const data = await this.getState();

    if (data.state === "CLOSED") return true;

    const now = Date.now();

    if (data.state === "OPEN") {
      if (now - data.lastStateChangeTime >= this.config.timeoutMs) {
        // 超时，原子抢占半开状态，且将尝试次数置为 1
        try {
          const result = await this.db
            .prepare(
              `UPDATE circuit_breakers 
               SET state = 'HALF_OPEN', half_open_attempts = 1, last_state_change_time = ? 
               WHERE service_name = ? AND state = 'OPEN' AND last_state_change_time = ?`
            )
            .bind(now, this.serviceName, data.lastStateChangeTime)
            .run();
          
          if (result.meta.changes > 0) {
            TraceLogger.info("KERNEL", "CIRCUIT_STATE_HALF_OPEN", this.traceId, `熔断器抢占半开成功: service=${this.serviceName}`);
            return true;
          }
        } catch (err: unknown) {
          TraceLogger.error("KERNEL", "CIRCUIT_CAS_HALF_OPEN_FAILED", this.traceId, `半开原子状态变更异常`, err);
        }
      }
      return false;
    }

    if (data.state === "HALF_OPEN") {
      // 半开状态，采用乐观锁增加 attempts，但严格不能超过 halfOpenMaxRequests
      try {
        const result = await this.db
          .prepare(
            `UPDATE circuit_breakers 
             SET half_open_attempts = half_open_attempts + 1 
             WHERE service_name = ? AND state = 'HALF_OPEN' AND half_open_attempts < ?`
          )
          .bind(this.serviceName, this.config.halfOpenMaxRequests)
          .run();

        if (result.meta.changes > 0) {
          return true;
        }
      } catch (err: unknown) {
        TraceLogger.error("KERNEL", "CIRCUIT_CAS_ATTEMPT_FAILED", this.traceId, `半开计数累加异常`, err);
      }
      return false;
    }

    return true;
  }

  /**
   * 记录成功调用 — 重置熔断器
   */
  async onSuccess(): Promise<void> {
    try {
      const now = Date.now();
      await this.db
        .prepare(
          `UPDATE circuit_breakers 
           SET state = 'CLOSED', failure_count = 0, half_open_attempts = 0, last_state_change_time = ? 
           WHERE service_name = ?`
        )
        .bind(now, this.serviceName)
        .run();
      TraceLogger.info("KERNEL", "CIRCUIT_RESET_CLOSED", this.traceId, `服务恢复正常，熔断器重置为 CLOSED: service=${this.serviceName}`);
    } catch (err: unknown) {
      TraceLogger.error("KERNEL", "CIRCUIT_ON_SUCCESS_FAILED", this.traceId, `更新熔断器成功标志异常`, err);
    }
  }

  /**
   * 记录失败调用
   * 采用单条 SQL 乐观锁原子更新实现累加与熔断判断
   */
  async onFailure(): Promise<void> {
    const now = Date.now();
    const data = await this.getState();

    try {
      if (data.state === "HALF_OPEN") {
        // 半开状态下的失败 → 立即退回 OPEN 状态
        await this.db
          .prepare(
            `UPDATE circuit_breakers 
             SET state = 'OPEN', last_state_change_time = ?, failure_count = failure_count + 1, last_failure_time = ?, half_open_attempts = 0
             WHERE service_name = ?`
          )
          .bind(now, now, this.serviceName)
          .run();
        TraceLogger.warn("KERNEL", "CIRCUIT_HALF_OPEN_TO_OPEN", this.traceId, `探针请求失败，熔断器重新开启为 OPEN: service=${this.serviceName}`);
      } else if (data.state === "CLOSED") {
        // CLOSED 状态下的失败，原子加 1 并在到达阈值后切换至 OPEN
        await this.db
          .prepare(
            `UPDATE circuit_breakers 
             SET 
               failure_count = failure_count + 1, 
               last_failure_time = ?,
               state = CASE WHEN failure_count + 1 >= ? THEN 'OPEN' ELSE 'CLOSED' END,
               last_state_change_time = CASE WHEN failure_count + 1 >= ? THEN ? ELSE last_state_change_time END
             WHERE service_name = ? AND state = 'CLOSED'`
          )
          .bind(now, this.config.failureThreshold, this.config.failureThreshold, now, this.serviceName)
          .run();
      }
    } catch (err: unknown) {
      TraceLogger.error("KERNEL", "CIRCUIT_ON_FAILURE_FAILED", this.traceId, `更新熔断器失败记录异常`, err);
    }
  }

  /**
   * 获取当前熔断状态摘要（用于日志/监控）
   */
  async getStatus(): Promise<{ state: CircuitState; failureCount: number }> {
    const data = await this.getState();
    return { state: data.state, failureCount: data.failureCount };
  }

  /**
   * 手动重置熔断器
   */
  async reset(): Promise<void> {
    try {
      await this.db
        .prepare(
          `UPDATE circuit_breakers 
           SET state = 'CLOSED', failure_count = 0, last_failure_time = 0, last_state_change_time = 0, half_open_attempts = 0 
           WHERE service_name = ?`
        )
        .bind(this.serviceName)
        .run();
    } catch (err: unknown) {
      TraceLogger.error("KERNEL", "CIRCUIT_RESET_FAILED", this.traceId, `手动重置熔断器异常`, err);
    }
  }
}
