// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/user/src/utils/drizzleInstance.ts
import { drizzle } from "drizzle-orm/d1";

const drizzleCache = new WeakMap<D1Database, any>();

/**
 * 基于 WeakMap 实现全局的 Drizzle 实例复用器，避免每次操作数据库都实例化
 */
export function getDrizzleDb(db: D1Database) {
  let client = drizzleCache.get(db);
  if (!client) {
    client = drizzle(db);
    drizzleCache.set(db, client);
  }
  return client;
}
