// File: packages/kernel/src/config.ts
/// <reference types="@cloudflare/workers-types" />

import { BusinessException } from "./business-error";
import { ErrorCode } from "./error-code";

/**
 * ConfigKey — 全局系统动态配置键强类型定义
 */
export type ConfigKey =
  // ─── 算力积分配置 ───
  | "credits.initial_credits"
  | "credits.invite_reward"
  | "credits.ad_reward"
  | "credits.task_cost"
  | "credits.default_page_limit"
  | "credits.credits_limit"
  
  // ─── 知识库与 RAG 配置 ───
  | "knowledge.default_chunk_size"
  | "knowledge.default_chunk_overlap"
  | "knowledge.default_top_k"
  | "knowledge.default_min_score"
  | "knowledge.max_context_length"
  | "knowledge.max_file_size"
  | "knowledge.max_concurrent_embeddings"
  | "knowledge.default_embed_model"
  
  // ─── 工作流与 AI 默认模型配置 ───
  | "workflow.default_max_loops"
  | "workflow.default_model"
  
  // ─── 测评配置 ───
  | "quiz.exp_per_level"
  | "quiz.quiz_pass_threshold"
  | "quiz.exp_stage_pass"
  | "quiz.exp_quiz_complete"
  | "quiz.exp_quiz_calculate"
  | "quiz.test_history_max_limit";

/**
 * DEFAULT_CONFIGS — 配置缺省默认回退字典
 */
export const DEFAULT_CONFIGS: Record<ConfigKey, string | number> = {
  "credits.initial_credits": 50,
  "credits.invite_reward": 50,
  "credits.ad_reward": 20,
  "credits.task_cost": 5,
  "credits.default_page_limit": 20,
  "credits.credits_limit": 50,

  "knowledge.default_chunk_size": 500,
  "knowledge.default_chunk_overlap": 100,
  "knowledge.default_top_k": 5,
  "knowledge.default_min_score": 0.4,
  "knowledge.max_context_length": 3000,
  "knowledge.max_file_size": 10485760, // 10 * 1024 * 1024 = 10MB
  "knowledge.max_concurrent_embeddings": 10,
  "knowledge.default_embed_model": "@cf/baai/bge-small-en-v1.5",

  "workflow.default_max_loops": 5,
  "workflow.default_model": "@cf/meta/llama-3.1-8b-instruct-fp8",

  "quiz.exp_per_level": 100,
  "quiz.quiz_pass_threshold": 0.6,
  "quiz.exp_stage_pass": 20,
  "quiz.exp_quiz_complete": 10,
  "quiz.exp_quiz_calculate": 5,
  "quiz.test_history_max_limit": 200,
};

interface CacheEntry {
  value: string;
  expireAt: number;
}

const localCache = new Map<string, CacheEntry>();
const MEMORY_TTL_MS = 10000; // 10秒本地 Isolate 级内存缓存

/**
 * ConfigService — 全局动态系统配置管理服务 (Shared Kernel 基础设施)
 */
export const ConfigService = {
  /**
   * 判断一个字符串键是否为合法的配置键
   */
  isValidKey(key: string): key is ConfigKey {
    return key in DEFAULT_CONFIGS;
  },

  /**
   * 清除本地缓存所有项，用于单元测试或物理强刷
   */
  clearLocalCache(): void {
    localCache.clear();
  },

  /**
   * 核心读取逻辑：从本地缓存或 D1 数据库查询配置
   */
  async get(db: D1Database, key: ConfigKey): Promise<string> {
    const now = Date.now();
    const cached = localCache.get(key);
    if (cached && cached.expireAt > now) {
      return cached.value;
    }

    try {
      // 从系统配置表中根据 key 检索配置值
      const row = await db
        .prepare("SELECT value FROM system_configs WHERE key = ? LIMIT 1")
        .bind(key)
        .first<{ value: string }>();

      const value = row ? row.value : String(DEFAULT_CONFIGS[key]);
      
      // 更新本地 Isolate 级内存缓存
      localCache.set(key, {
        value,
        expireAt: now + MEMORY_TTL_MS,
      });

      return value;
    } catch (e) {
      // 容灾设计：查询失败时自动 Fallback 到代码写死的默认字典，并记录警告日志
      const fallbackValue = String(DEFAULT_CONFIGS[key]);
      return fallbackValue;
    }
  },

  /**
   * 获取数值型配置项
   */
  async getNumber(db: D1Database, key: ConfigKey): Promise<number> {
    const rawValue = await this.get(db, key);
    const num = Number(rawValue);
    if (isNaN(num)) {
      // 若解析为 NaN 则回退到默认值
      return Number(DEFAULT_CONFIGS[key]);
    }
    return num;
  },

  /**
   * 获取布尔型配置项
   */
  async getBoolean(db: D1Database, key: ConfigKey): Promise<boolean> {
    const rawValue = await this.get(db, key);
    return rawValue === "true" || rawValue === "1";
  },

  /**
   * 更新配置值（支持热更新）
   */
  async set(db: D1Database, key: ConfigKey, value: string | number, kv?: KVNamespace): Promise<void> {
    const valStr = String(value);
    const nowIso = new Date().toISOString();

    try {
      // 写入 D1 数据库
      await db
        .prepare(
          "INSERT OR REPLACE INTO system_configs (key, value, updated_at) VALUES (?, ?, ?)"
        )
        .bind(key, valStr, nowIso)
        .run();

      // 清除本地缓存
      localCache.delete(key);

      // 如果有 KV 缓存绑定的，则一并同步刷新 KV
      if (kv) {
        const cacheKey = `sys_cfg:${key}`;
        await kv.put(cacheKey, JSON.stringify({ value: valStr, ttl: 86400 }), { expirationTtl: 86400 });
      }
    } catch (e) {
      throw new BusinessException(
        ErrorCode.INTERNAL,
        `更新系统配置失败: key=${key}, error=${e instanceof Error ? e.message : String(e)}`
      );
    }
  },

  /**
   * 获取当前系统所有的配置值列表（优先读取数据库，无则读取缺省默认值）
   */
  async getAll(db: D1Database): Promise<Record<ConfigKey, string | number>> {
    const allKeys = Object.keys(DEFAULT_CONFIGS) as ConfigKey[];
    const result = {} as Record<ConfigKey, string | number>;

    try {
      // 批量查询当前 D1 中配置了的值
      const { results } = await db
        .prepare("SELECT key, value FROM system_configs")
        .all<{ key: string; value: string }>();

      const dbMap = new Map<string, string>();
      if (results) {
        for (const row of results) {
          dbMap.set(row.key, row.value);
        }
      }

      for (const key of allKeys) {
        const dbVal = dbMap.get(key);
        if (dbVal !== undefined) {
          // 对比默认配置类型，尽可能还原数值类型
          const defaultType = typeof DEFAULT_CONFIGS[key];
          if (defaultType === "number") {
            const num = Number(dbVal);
            result[key] = isNaN(num) ? dbVal : num;
          } else {
            result[key] = dbVal;
          }
        } else {
          result[key] = DEFAULT_CONFIGS[key];
        }
      }
    } catch (e) {
      // 异常情况下，直接返回默认配置的浅拷贝
      return { ...DEFAULT_CONFIGS };
    }

    return result;
  }
};
