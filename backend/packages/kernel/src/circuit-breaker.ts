/**
 * CircuitBreaker — 基于 KV 的轻量级熔断器
 *
 * 三态模型（参考 Netflix Hystrix / Spring Cloud Circuit Breaker）：
 *   CLOSED   → 正常，请求通过
 *   OPEN     → 熔断，直接返回降级响应
 *   HALF_OPEN → 半开，允许探针请求检测是否恢复
 *
 * 状态存储在 KV 中，所有 Worker 共享熔断状态。
 *
 * 使用方式：
 *   const cb = new CircuitBreaker(kv, "rag-svc", traceId);
 *   const result = await cb.call(() => ragSvc.fetch(request));
 *   if (!result.ok) return cb.fallback();
 */

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

const KEY_PREFIX = "cb:";

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
    private kv: KVNamespace,
    private serviceName: string,
    private traceId: string,
    config?: Partial<CircuitConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private key(): string {
    return `${KEY_PREFIX}${this.serviceName}`;
  }

  private async getState(): Promise<CircuitData> {
    try {
      const raw = await this.kv.get(this.key());
      if (!raw) {
        return { state: "CLOSED", failureCount: 0, lastFailureTime: 0, lastStateChangeTime: 0, halfOpenAttempts: 0 };
      }
      return JSON.parse(raw);
    } catch {
      return { state: "CLOSED", failureCount: 0, lastFailureTime: 0, lastStateChangeTime: 0, halfOpenAttempts: 0 };
    }
  }

  private async saveState(data: CircuitData): Promise<void> {
    try {
      await this.kv.put(this.key(), JSON.stringify(data), { expirationTtl: 86400 });
    } catch {
      // 熔断器状态保存失败不应影响主流程
    }
  }

  /**
   * 判断是否允许请求通过
   */
  async allowRequest(): Promise<boolean> {
    const data = await this.getState();

    if (data.state === "CLOSED") return true;

    if (data.state === "OPEN") {
      const now = Date.now();
      if (now - data.lastStateChangeTime >= this.config.timeoutMs) {
        // 超时 → 进入半开状态
        data.state = "HALF_OPEN";
        data.halfOpenAttempts = 0;
        data.lastStateChangeTime = now;
        await this.saveState(data);
        return true;
      }
      return false;
    }

    // HALF_OPEN: 只允许有限数量的探针请求
    if (data.halfOpenAttempts < this.config.halfOpenMaxRequests) {
      data.halfOpenAttempts++;
      await this.saveState(data);
      return true;
    }
    return false;
  }

  /**
   * 记录成功调用 — 重置熔断器
   */
  async onSuccess(): Promise<void> {
    const data = await this.getState();
    if (data.state === "CLOSED") return; // 已经是 CLOSED，无需操作
    data.state = "CLOSED";
    data.failureCount = 0;
    data.lastStateChangeTime = Date.now();
    data.halfOpenAttempts = 0;
    await this.saveState(data);
  }

  /**
   * 记录失败调用
   */
  async onFailure(): Promise<void> {
    const data = await this.getState();
    data.failureCount++;
    data.lastFailureTime = Date.now();

    if (data.state === "HALF_OPEN") {
      // 半开状态下的失败 → 立即回到 OPEN
      data.state = "OPEN";
      data.lastStateChangeTime = Date.now();
    } else if (data.state === "CLOSED" && data.failureCount >= this.config.failureThreshold) {
      // 连续失败达到阈值 → 开启熔断
      data.state = "OPEN";
      data.lastStateChangeTime = Date.now();
    }

    await this.saveState(data);
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
    const data = { state: "CLOSED" as CircuitState, failureCount: 0, lastFailureTime: 0, lastStateChangeTime: 0, halfOpenAttempts: 0 };
    await this.saveState(data);
  }
}
