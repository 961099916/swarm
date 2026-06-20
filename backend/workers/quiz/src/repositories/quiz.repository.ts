// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/repositories/quiz.repository.ts

import { quizUsers, testHistory, userStageProgress, systemConfigs } from "@swarm/quiz";
import type { QuizUserRow, UserStageProgressRow, TestHistoryRow } from "@swarm/quiz";
import { EXP_PER_LEVEL, QUIZ_PASS_THRESHOLD } from "@swarm/quiz";
import { TraceLogger } from "@swarm/kernel";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";

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

export class QuizRepository {
  constructor(private db: D1Database) {}

  private getDrizzle() {
    return drizzle(this.db);
  }

  private mapQuizUserToRow(row: typeof quizUsers.$inferSelect): QuizUserRow {
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

  private mapStageProgressToRow(row: typeof userStageProgress.$inferSelect): UserStageProgressRow {
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

  private mapTestHistoryToRow(row: typeof testHistory.$inferSelect): TestHistoryRow {
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

  public async getUserQuiz(userId: string): Promise<QuizUserRow | null> {
    const drizzleDb = this.getDrizzle();
    const results = await drizzleDb
      .select()
      .from(quizUsers)
      .where(eq(quizUsers.userId, userId));

    return results && results.length > 0 ? this.mapQuizUserToRow(results[0]) : null;
  }

  public async ensureUserQuiz(userId: string): Promise<QuizUserSnapshot> {
    const existing = await this.getUserQuiz(userId);
    if (existing) return existing;

    try {
      const drizzleDb = this.getDrizzle();
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

  public async addExp(userId: string, exp: number): Promise<{ previousLevel: number; newLevel: number }> {
    const user = await this.ensureUserQuiz(userId);
    const previousLevel = user.level ?? 1;
    const newExp = (user.exp ?? 0) + exp;
    const expPerLevel = EXP_PER_LEVEL;
    const newLevel = newExp >= (user.level ?? 1) * expPerLevel
      ? Math.floor(newExp / expPerLevel) + 1
      : (user.level ?? 1);
    const now = new Date().toISOString();

    const drizzleDb = this.getDrizzle();
    await drizzleDb
      .update(quizUsers)
      .set({ exp: newExp, level: newLevel, updatedAt: now })
      .where(eq(quizUsers.userId, userId));

    return { previousLevel, newLevel };
  }

  public async incrementCompleted(userId: string, isNewType: boolean): Promise<void> {
    await this.ensureUserQuiz(userId);
    const now = new Date().toISOString();
    const drizzleDb = this.getDrizzle();

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

  public async getTestHistory(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<TestHistoryRow[]> {
    const drizzleDb = this.getDrizzle();
    const results = await drizzleDb
      .select()
      .from(testHistory)
      .where(eq(testHistory.userId, userId))
      .orderBy(desc(testHistory.createdAt))
      .limit(limit)
      .offset(offset);

    return (results || []).map(r => this.mapTestHistoryToRow(r));
  }

  public async saveTestHistory(item: SaveTestHistoryInput): Promise<void> {
    const drizzleDb = this.getDrizzle();
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

  public async deleteTestHistory(historyId: string, userId: string): Promise<boolean> {
    const drizzleDb = this.getDrizzle();
    const result = await drizzleDb
      .delete(testHistory)
      .where(and(eq(testHistory.id, historyId), eq(testHistory.userId, userId)));

    return (result.meta.changes ?? 0) > 0;
  }

  public async getStageProgress(
    userId: string,
    stageId: string
  ): Promise<UserStageProgressRow[]> {
    const drizzleDb = this.getDrizzle();
    const results = await drizzleDb
      .select()
      .from(userStageProgress)
      .where(and(eq(userStageProgress.userId, userId), eq(userStageProgress.stageId, stageId)));

    return (results || []).map(r => this.mapStageProgressToRow(r));
  }

  public async getAllStageProgress(userId: string): Promise<UserStageProgressRow[]> {
    const drizzleDb = this.getDrizzle();
    const results = await drizzleDb
      .select()
      .from(userStageProgress)
      .where(eq(userStageProgress.userId, userId));

    return (results || []).map(r => this.mapStageProgressToRow(r));
  }

  public async saveStageProgress(
    userId: string,
    stageId: string,
    npcId: string,
    score: number,
    total: number
  ): Promise<void> {
    const passed = score >= total * QUIZ_PASS_THRESHOLD ? 1 : 0;
    const now = new Date().toISOString();
    const drizzleDb = this.getDrizzle();

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

  public async resetUserProgress(userId: string): Promise<boolean> {
    const drizzleDb = this.getDrizzle();
    const now = new Date().toISOString();
    
    // 物理清理当前用户的关卡挑战进度记录
    await drizzleDb
      .delete(userStageProgress)
      .where(eq(userStageProgress.userId, userId));
      
    // 将评测总等级和经验重置
    await drizzleDb
      .update(quizUsers)
      .set({
        exp: 0,
        level: 1,
        differentCount: 0,
        completedCount: 0,
        updatedAt: now
      })
      .where(eq(quizUsers.userId, userId));

    return true;
  }

  public async getSystemConfigs(): Promise<{ key: string; value: string }[]> {
    const drizzleDb = this.getDrizzle();
    const results = await drizzleDb
      .select()
      .from(systemConfigs);
    return (results || []).map(r => ({ key: r.key, value: r.value }));
  }

  public async saveSystemConfig(key: string, value: string): Promise<void> {
    const drizzleDb = this.getDrizzle();
    const now = new Date().toISOString();
    await drizzleDb
      .insert(systemConfigs)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value, updatedAt: now }
      });
  }
}
