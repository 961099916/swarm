// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/packages/kernel/test/config.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigService, DEFAULT_CONFIGS, ConfigKey } from "../src/config";
import { BusinessException, handleGlobalError } from "../src/business-error";

// 构造 Mock D1 数据库
function createMockD1(store: Map<string, string>): D1Database {
  const prepareMock = (sql: string) => {
    return {
      bind: (...args: any[]) => {
        return {
          first: async <T>() => {
            const key = args[0] as string;
            const value = store.get(key);
            if (value === undefined) return null as T;
            return { value } as T;
          },
          run: async () => {
            const key = args[0] as string;
            const value = String(args[1]);
            store.set(key, value);
            return { success: true, meta: {} };
          }
        };
      },
      all: async () => {
        const results: { key: string; value: string }[] = [];
        store.forEach((value, key) => {
          results.push({ key, value });
        });
        return { results, success: true, meta: {} };
      }
    };
  };

  return {
    prepare: vi.fn(prepareMock),
    batch: vi.fn()
  } as unknown as D1Database;
}

describe("ConfigService && BusinessException 单元测试", () => {
  let dbStore: Map<string, string>;
  let mockDb: D1Database;

  beforeEach(() => {
    dbStore = new Map<string, string>();
    mockDb = createMockD1(dbStore);
    ConfigService.clearLocalCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("ConfigService 核心读取与 Fallback 机制", () => {
    it("当数据库缺失配置时，应优雅退回到 DEFAULT_CONFIGS 缺省值", async () => {
      const value = await ConfigService.get(mockDb, "credits.initial_credits");
      expect(value).toBe(String(DEFAULT_CONFIGS["credits.initial_credits"]));
    });

    it("当数据库配置存在时，应成功读取并返回数据库内记录的值", async () => {
      dbStore.set("credits.initial_credits", "100");
      const value = await ConfigService.get(mockDb, "credits.initial_credits");
      expect(value).toBe("100");
    });

    it("ConfigService.getNumber 应正确转换为数值型", async () => {
      dbStore.set("credits.task_cost", "25");
      const cost = await ConfigService.getNumber(mockDb, "credits.task_cost");
      expect(cost).toBe(25);
    });

    it("ConfigService.getBoolean 应正确转换布尔型", async () => {
      dbStore.set("knowledge.default_min_score", "1"); // 兼容 1/true 判定
      const b1 = await ConfigService.getBoolean(mockDb, "knowledge.default_min_score");
      expect(b1).toBe(true);

      ConfigService.clearLocalCache();
      dbStore.set("knowledge.default_min_score", "false");
      const b2 = await ConfigService.getBoolean(mockDb, "knowledge.default_min_score");
      expect(b2).toBe(false);
    });
  });

  describe("Isolate 本地内存缓存与热更新清除机制", () => {
    it("重复读取应命中 10s 本地缓存而无需高频访问 D1 物理数据库", async () => {
      dbStore.set("workflow.default_max_loops", "8");
      
      const val1 = await ConfigService.get(mockDb, "workflow.default_max_loops");
      expect(val1).toBe("8");
      
      // 更改 D1 物理数据
      dbStore.set("workflow.default_max_loops", "12");
      
      // 再次读取（在 10s TTL 内应依然命中本地缓存旧值）
      const val2 = await ConfigService.get(mockDb, "workflow.default_max_loops");
      expect(val2).toBe("8");

      // 时间向前推进 11 秒，缓存应该过期
      vi.advanceTimersByTime(11000);

      const val3 = await ConfigService.get(mockDb, "workflow.default_max_loops");
      expect(val3).toBe("12"); // 重新穿透到 D1 获取到最新热更值
    });

    it("调用 ConfigService.set 写入新参数时应自动清除本地缓存并写入 D1", async () => {
      dbStore.set("quiz.exp_per_level", "100");
      const val1 = await ConfigService.get(mockDb, "quiz.exp_per_level");
      expect(val1).toBe("100");

      // 通过 set 进行配置写入
      await ConfigService.set(mockDb, "quiz.exp_per_level", 200);

      // set 之后再次 get，应该无需等待 10s 缓存直接拿到最新写入值
      const val2 = await ConfigService.get(mockDb, "quiz.exp_per_level");
      expect(val2).toBe("200");
      expect(dbStore.get("quiz.exp_per_level")).toBe("200");
    });
  });

  describe("ConfigService.getAll 批量加载配置", () => {
    it("getAll 应一次性返回当前所有的系统合并配置对象", async () => {
      dbStore.set("credits.initial_credits", "99");
      dbStore.set("workflow.default_model", "custom-model");

      const all = await ConfigService.getAll(mockDb);
      expect(all["credits.initial_credits"]).toBe(99); // D1 自定义值且转为了数值类型
      expect(all["workflow.default_model"]).toBe("custom-model"); // D1 自定义值
      expect(all["quiz.quiz_pass_threshold"]).toBe(DEFAULT_CONFIGS["quiz.quiz_pass_threshold"]); // 默认回退值
    });
  });

  describe("BusinessException && handleGlobalError 异常拦截机制", () => {
    it("BusinessException 应正确存储异常码、异常提示及 HttpStatus", () => {
      const exc = new BusinessException(3001, "积分不足", 400);
      expect(exc.code).toBe(3001);
      expect(exc.message).toBe("积分不足");
      expect(exc.httpStatus).toBe(400);
      expect(exc).toBeInstanceOf(BusinessException);
    });

    it("handleGlobalError 应正确捕获 BusinessException 并转换为 ApiRes 结构输出", () => {
      const mockContext = {
        store: new Map<string, any>(),
        get(key: string) { return this.store.get(key); },
        json: vi.fn((body: any, status?: any) => ({ body, status }))
      };
      mockContext.store.set("traceId", "test-trace-id");

      const err = new BusinessException(2001, "用户未登录", 401);
      const res = handleGlobalError(err, mockContext as any, "TEST_MODULE");

      expect(mockContext.json).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(2001);
      expect(res.body.message).toBe("用户未登录");
      expect(res.body.traceId).toBe("test-trace-id");
    });
  });
});
