// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/db/client.ts

import { quizUsers, testHistory, userStageProgress, systemConfigs } from "@swarm/quiz";
import type { QuizUserRow, StageProgressRow, TestHistoryRow } from "@swarm/quiz";
import { EXP_PER_LEVEL, QUIZ_PASS_THRESHOLD } from "@swarm/quiz";
import { TraceLogger } from "@swarm/kernel";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";

const drizzleCache = new WeakMap<D1Database, any>();

/**
 * 基于 WeakMap 缓存 drizzle 实例，复用 D1 数据访问实例以降低 GC 开销
 */
function getDrizzleDb(db: D1Database) {
  let client = drizzleCache.get(db);
  if (!client) {
    client = drizzle(db);
    drizzleCache.set(db, client);
  }
  return client;
}

interface SaveTestHistoryInput {
  id: string;
  userId: string;
  testId: string;
  testTitle: string;
  testType: string;
  resultCode: string;
  resultName: string;
  rawScores: string;
}

interface QuizUserSnapshot {
  user_id: string;
  exp: number;
  level: number;
  different_count: number;
  completed_count: number;
}

function mapQuizUserToRow(row: typeof quizUsers.$inferSelect): QuizUserRow {
  return {
    user_id: row.userId,
    exp: row.exp,
    level: row.level,
    different_count: row.differentCount,
    completed_count: row.completedCount,
    updated_at: row.updatedAt,
    created_at: row.createdAt,
  };
}

function mapStageProgressToRow(row: typeof userStageProgress.$inferSelect): StageProgressRow {
  return {
    user_id: row.userId,
    stage_id: row.stageId,
    npc_id: row.npcId,
    score: row.score,
    total: row.total,
    passed: row.passed,
    updated_at: row.updatedAt,
  };
}

function mapTestHistoryToRow(row: typeof testHistory.$inferSelect): TestHistoryRow {
  return {
    id: row.id,
    user_id: row.userId,
    test_id: row.testId,
    test_title: row.testTitle,
    test_type: row.testType,
    result_code: row.resultCode,
    result_name: row.resultName,
    raw_scores: row.rawScores,
    created_at: row.createdAt,
  };
}

export class DbClient {
  
  static async getUserQuiz(db: D1Database, userId: string): Promise<QuizUserRow | null> {
    const drizzleDb = getDrizzleDb(db);
    const results = await drizzleDb
      .select()
      .from(quizUsers)
      .where(eq(quizUsers.userId, userId));

    return results && results.length > 0 ? mapQuizUserToRow(results[0]) : null;
  }

  static async ensureUserQuiz(db: D1Database, userId: string): Promise<QuizUserSnapshot> {
    const existing = await this.getUserQuiz(db, userId);
    if (existing) return existing;

    try {
      const drizzleDb = getDrizzleDb(db);
      const now = new Date().toISOString();
      await drizzleDb.insert(quizUsers).values({
        userId,
        exp: 0,
        level: 1,
        differentCount: 0,
        completedCount: 0,
        createdAt: now,
      }).onConflictDoNothing();
    } catch {
      // FK 约束不通过时静默降级
    }

    return { user_id: userId, exp: 0, level: 1, different_count: 0, completed_count: 0 };
  }

  static async addExp(db: D1Database, userId: string, exp: number): Promise<{ previousLevel: number; newLevel: number }> {
    const user = await this.ensureUserQuiz(db, userId);
    const previousLevel = user.level ?? 1;
    const newExp = (user.exp ?? 0) + exp;
    const expPerLevel = EXP_PER_LEVEL;
    const newLevel = newExp >= (user.level ?? 1) * expPerLevel
      ? Math.floor(newExp / expPerLevel) + 1
      : (user.level ?? 1);
    const now = new Date().toISOString();

    const drizzleDb = getDrizzleDb(db);
    await drizzleDb
      .update(quizUsers)
      .set({ exp: newExp, level: newLevel, updatedAt: now })
      .where(eq(quizUsers.userId, userId));

    return { previousLevel, newLevel };
  }

  static async incrementCompleted(db: D1Database, userId: string, isNewType: boolean): Promise<void> {
    await this.ensureUserQuiz(db, userId);
    const now = new Date().toISOString();
    const drizzleDb = getDrizzleDb(db);

    if (isNewType) {
      await drizzleDb
        .update(quizUsers)
        .set({
          completedCount: sql`completed_count + 1`,
          differentCount: sql`different_count + 1`,
          updatedAt: now,
        })
        .where(eq(quizUsers.userId, userId));
    } else {
      await drizzleDb
        .update(quizUsers)
        .set({
          completedCount: sql`completed_count + 1`,
          updatedAt: now,
        })
        .where(eq(quizUsers.userId, userId));
    }
  }

  static async getTestHistory(
    db: D1Database,
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<TestHistoryRow[]> {
    const drizzleDb = getDrizzleDb(db);
    const results = await drizzleDb
      .select()
      .from(testHistory)
      .where(eq(testHistory.userId, userId))
      .orderBy(desc(testHistory.createdAt))
      .limit(limit)
      .offset(offset);

    return (results || []).map(mapTestHistoryToRow);
  }

  static async saveTestHistory(db: D1Database, item: SaveTestHistoryInput): Promise<void> {
    const drizzleDb = getDrizzleDb(db);
    const now = new Date().toISOString();
    await drizzleDb.insert(testHistory).values({
      id: item.id,
      userId: item.userId,
      testId: item.testId,
      testTitle: item.testTitle,
      testType: item.testType,
      resultCode: item.resultCode,
      resultName: item.resultName,
      rawScores: item.rawScores,
      createdAt: now,
    });
  }

  static async deleteTestHistory(db: D1Database, historyId: string, userId: string): Promise<boolean> {
    const drizzleDb = getDrizzleDb(db);
    const result = await drizzleDb
      .delete(testHistory)
      .where(and(eq(testHistory.id, historyId), eq(testHistory.userId, userId)));

    return (result.meta.changes ?? 0) > 0;
  }

  static async getStageProgress(
    db: D1Database,
    userId: string,
    stageId: string
  ): Promise<StageProgressRow[]> {
    const drizzleDb = getDrizzleDb(db);
    const results = await drizzleDb
      .select()
      .from(userStageProgress)
      .where(and(eq(userStageProgress.userId, userId), eq(userStageProgress.stageId, stageId)));

    return (results || []).map(mapStageProgressToRow);
  }

  static async getAllStageProgress(db: D1Database, userId: string): Promise<StageProgressRow[]> {
    const drizzleDb = getDrizzleDb(db);
    const results = await drizzleDb
      .select()
      .from(userStageProgress)
      .where(eq(userStageProgress.userId, userId));

    return (results || []).map(mapStageProgressToRow);
  }

  static async saveStageProgress(
    db: D1Database,
    userId: string,
    stageId: string,
    npcId: string,
    score: number,
    total: number
  ): Promise<void> {
    const passed = score >= total * QUIZ_PASS_THRESHOLD ? 1 : 0;
    const now = new Date().toISOString();
    const drizzleDb = getDrizzleDb(db);

    await drizzleDb
      .insert(userStageProgress)
      .values({
        userId,
        stageId,
        npcId,
        score,
        total,
        passed,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userStageProgress.userId, userStageProgress.stageId, userStageProgress.npcId],
        set: { score, total, passed, updatedAt: now },
      });
  }

  static async getConfig(db: D1Database, key: string): Promise<string | null> {
    const drizzleDb = getDrizzleDb(db);
    const results = await drizzleDb
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key));

    return results && results.length > 0 ? results[0].value : null;
  }

  static async setConfig(db: D1Database, key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    const drizzleDb = getDrizzleDb(db);
    await drizzleDb
      .insert(systemConfigs)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value, updatedAt: now },
      });
  }
}
