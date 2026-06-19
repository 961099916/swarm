// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/quiz/src/index.ts

import { Hono } from 'hono';
import { CONFIG } from './config';
import { DbClient } from './db/client';
import {
  LOBBY_MAP_CONFIG, FUN_LOBBY_MAP_CONFIG, STAGE_NPCS_RAW, PORTAL_SVGS
} from './evaluator/mapConfigs';
import { STAGE_CONFIGS } from './evaluator/stageConfigs';
import { calculateLocalQuiz, QUIZ_META } from './evaluator/questions';
import type { QuizVariables, AnswerSubmit, NPCChallengeConfig } from './types';
import {
  QUIZ_PASS_THRESHOLD,
  EXP_STAGE_PASS,
  EXP_QUIZ_COMPLETE,
  EXP_QUIZ_CALCULATE,
  TEST_HISTORY_MAX_LIMIT,
} from '@swarm/quiz';
import { TraceLogger, CacheService, startupSecurityCheck } from '@swarm/kernel';

export interface Env {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  INTERNAL_SECRET: string;
}

const app = new Hono<{ Bindings: Env; Variables: { traceId: string; userId: string } }>();

// ─── 全局安全中间件 ───

app.use('*', async (c, next) => {
  const traceId = c.req.header('X-Trace-Id') || crypto.randomUUID();
  c.set('traceId', traceId);
  c.header('X-Trace-Id', traceId);

  // 1. 启动 Fail-Fast 安全健康预检
  const checkError = await startupSecurityCheck(c.env, traceId, ['INTERNAL_SECRET']);
  if (checkError) return checkError;

  // 2. 内部通信签名拦截，阻断外网直连
  const internalKey = c.req.header('X-Internal-Key');
  if (!internalKey || internalKey !== c.env.INTERNAL_SECRET) {
    TraceLogger.warn('QUIZ', 'UNAUTHORIZED_BYPASS', traceId, `安全拦截：非法客户端绕过网关直接请求评测服务`);
    return c.json({ code: 401, message: 'Unauthorized', traceId }, 401);
  }

  // 3. 身份元数据绑定
  const userId = c.req.header('X-User-Id');
  if (!userId) {
    return c.json({ code: 403, message: 'Missing user metadata', traceId }, 403);
  }
  
  c.set('userId', userId);

  // 4. 抓取入参
  let query = c.req.query();
  let requestBody: any = null;
  const contentType = c.req.header('Content-Type') || '';
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && contentType.includes('application/json')) {
    try {
      const clonedReq = c.req.raw.clone();
      requestBody = await clonedReq.json();
    } catch (err) {
      // 容错
    }
  }

  TraceLogger.info('QUIZ', 'REQUEST_INBOUND', traceId, `Quiz Worker 接收内部请求: ${c.req.method} ${c.req.path}`, userId, {
    query,
    body: requestBody
  });

  const startTime = Date.now();
  await next();
  const durationMs = Date.now() - startTime;

  // 5. 抓取出参
  let responseBody: any = null;
  let status = 200;
  if (c.res) {
    status = c.res.status;
    const resContentType = c.res.headers.get('Content-Type') || '';
    if (resContentType.includes('application/json')) {
      try {
        const clonedRes = c.res.clone();
        const text = await clonedRes.text();
        if (text.length < 2000) {
          responseBody = JSON.parse(text);
        } else {
          responseBody = { truncated: text.slice(0, 1000) + '... (truncated)' };
        }
      } catch (err) {
        // 容错
      }
    }
  }

  TraceLogger.info('QUIZ', 'REQUEST_OUTBOUND', traceId, `Quiz Worker 完成请求响应: ${c.req.method} ${c.req.path} -> [${status}] (${durationMs}ms)`, userId, {
    status,
    durationMs,
    response: responseBody
  });
});

// ─── 辅助函数 ───
function mapProgressRow(p: StageProgressRow) {
  return {
    stageId: p.stage_id,
    npcId: p.npc_id,
    score: p.score,
    total: p.total,
    passed: p.passed === 1,
  };
}

function stripCorrectAnswers(challenge: NPCChallengeConfig) {
  return challenge.questions.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options,
  }));
}

// ═════════════════════════════════════
// 地图配置接口
// ═════════════════════════════════════
app.get('/api/v1/quiz/map-config', async (c) => {
  const stageId = c.req.query('stageId') || 'lobby';
  const traceId = c.get('traceId');
  const userId = c.get('userId');
  let userLevel = 1;

  try {
    const cacheKey = `user:quiz:${userId}`;
    
    // 优先读取 KV 缓存
    let userQuiz = await CacheService.get<any>(c.env.CACHE_KV, cacheKey);
    if (userQuiz === undefined) {
      userQuiz = await DbClient.getUserQuiz(c.env.DB, userId);
      await CacheService.set(c.env.CACHE_KV, cacheKey, userQuiz, 7200);
    }
    userLevel = userQuiz?.level ?? 1;
  } catch (e: any) {
    TraceLogger.warn('QUIZ', 'GET_USER_QUIZ_CACHE_FAILED', traceId, `读取用户关卡等级失败，降级回源: ${e.message}`, userId);
  }

  if (stageId === 'lobby') {
    const filteredObstacles = LOBBY_MAP_CONFIG.obstacles.filter(
      (obs) => !obs.activeUntilLevel || userLevel < obs.activeUntilLevel
    );
    return c.json({
      code: 200, message: 'success',
      data: { ...LOBBY_MAP_CONFIG, obstacles: filteredObstacles },
      traceId,
    });
  }

  if (stageId === 'fun_lobby') {
    return c.json({ code: 200, message: 'success', data: FUN_LOBBY_MAP_CONFIG, traceId });
  }

  const stage = STAGE_CONFIGS[stageId];
  if (!stage) {
    return c.json({ code: 404, message: `未找到关卡地图: ${stageId}`, traceId }, 404);
  }

  let isStagePassed = false;
  try {
    if (userLevel > stage.stageOrder) {
      isStagePassed = true;
    } else if (userLevel === stage.stageOrder) {
      const progress = await DbClient.getStageProgress(c.env.DB, userId, stageId);
      const passedNpcIds = new Set(
        progress.filter((ch) => ch.passed === 1).map((ch) => ch.npc_id)
      );
      isStagePassed = stage.challenges.every((ch) => passedNpcIds.has(ch.npcId));
    }
  } catch (e: any) {
    TraceLogger.error('QUIZ', 'GET_STAGE_PASS_STATUS_FAILED', traceId, `判断通关状态异常: ${e.message}`, e, userId);
  }

  const npcList: Record<string, unknown> = {};
  for (const [key, npc] of Object.entries(STAGE_NPCS_RAW)) {
    if (npc.stageId === stageId) {
      npcList[key] = npc;
    }
  }
  if (isStagePassed) {
    npcList['portal_stone_exit'] = {
      id: 'portal_stone_exit', name: '回大厅传送阵',
      x: 80, y: 80, stageId, npcType: 'portal_exit',
      dialogueText: '触摸传送阵，即可返回学堂大厅。',
      avatarSvg: PORTAL_SVGS.exit, radius: 35,
    };
  }

  return c.json({
    code: 200, message: 'success',
    data: {
      width: 400, height: 400, playerSpawnX: 180, playerSpawnY: 180,
      obstacles: [], npcList,
    },
    traceId,
  });
});

// ═════════════════════════════════════
// 关卡状态接口
// ═════════════════════════════════════
app.get('/api/v1/quiz/stages/status', async (c) => {
  const userId = c.get('userId');
  const traceId = c.get('traceId');

  try {
    const cacheKey = `user:quiz:${userId}`;
    let user = await CacheService.get<any>(c.env.CACHE_KV, cacheKey);
    if (user === undefined) {
      user = await DbClient.ensureUserQuiz(c.env.DB, userId);
      await CacheService.set(c.env.CACHE_KV, cacheKey, user, 7200);
    }
    
    const progress = await DbClient.getAllStageProgress(c.env.DB, userId);
    return c.json({
      code: 200, message: 'success',
      data: {
        currentLevel: user.level,
        stageName: CONFIG.getStageNameByLevel(user.level),
        exp: user.exp ?? 0,
        completedCount: user.completed_count ?? 0,
        differentCount: user.different_count ?? 0,
        progress: progress.map(mapProgressRow),
      },
      traceId,
    });
  } catch (error: any) {
    TraceLogger.error('QUIZ', 'GET_STAGE_STATUS_FAILED', traceId, `获取关卡进度失败: ${error.message || error}`, error, userId);
    return c.json({ code: 500, message: '获取进度失败', traceId }, 500);
  }
});

// ═════════════════════════════════════
// 获取 NPC 题目
// ═════════════════════════════════════
app.get('/api/v1/quiz/stages/:stageId/npcs/:npcId/questions', async (c) => {
  const stageId = c.req.param('stageId');
  const npcId = c.req.param('npcId');
  const traceId = c.get('traceId');

  const stage = STAGE_CONFIGS[stageId];
  if (stage) {
    const challenge = stage.challenges.find((ch) => ch.npcId === npcId);
    if (!challenge) {
      return c.json({ code: 404, message: '找不到指定的 NPC 考核', traceId }, 404);
    }
    return c.json({
      code: 200, message: 'success',
      data: stripCorrectAnswers(challenge),
      traceId,
    });
  }

  const quizMeta = QUIZ_META[npcId as keyof typeof QUIZ_META];
  if (!quizMeta) {
    return c.json({ code: 404, message: '找不到指定的题库', traceId }, 404);
  }
  const secureQuestions = quizMeta.questions.map((q) => ({
    id: q.id, text: q.text, options: q.options, inkblotSvg: q.inkblotSvg,
  }));
  return c.json({ code: 200, message: 'success', data: secureQuestions, traceId });
});

// ═════════════════════════════════════
// 提交答案 + 自动升级
// ═════════════════════════════════════
app.post('/api/v1/quiz/stages/:stageId/npcs/:npcId/submit', async (c) => {
  const userId = c.get('userId');
  const traceId = c.get('traceId');
  const stageId = c.req.param('stageId');
  const npcId = c.req.param('npcId');

  const body = await c.req.json<{ answers?: AnswerSubmit[] }>();
  const { answers } = body;
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return c.json({ code: 400, message: '参数错误：answers 不能为空', traceId }, 400);
  }

  let score = 0;
  let total = 0;

  const stage = STAGE_CONFIGS[stageId];
  if (stage) {
    const challenge = stage.challenges.find((ch) => ch.npcId === npcId);
    if (challenge) {
      total = challenge.questions.length;
      score = answers.filter((a) => {
        const q = challenge.questions.find((qq) => qq.id === a.questionId);
        return q && q.correctId === a.selectedOptionId;
      }).length;
    }
  }

  let stageLevelUp = false;
  let nextLevelName: string | undefined;
  let stageHistoryId: string | undefined;

  if (total > 0) {
    const challenge = STAGE_CONFIGS[stageId]?.challenges.find((ch) => ch.npcId === npcId);
    await DbClient.saveStageProgress(c.env.DB, userId, stageId, npcId, score, total);

    const passed = score >= total * QUIZ_PASS_THRESHOLD;
    stageHistoryId = crypto.randomUUID();
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    
    await DbClient.saveTestHistory(c.env.DB, {
      id: stageHistoryId,
      userId,
      testId: `${stageId}/${npcId}`,
      testTitle: challenge?.npcName || npcId,
      testType: 'STUDY',
      resultCode: passed ? 'PASSED' : 'FAILED',
      resultName: passed ? '成绩合格' : '不合格',
      rawScores: JSON.stringify({ score, total, passed, percentage }),
    });

    if (score >= total * QUIZ_PASS_THRESHOLD) {
      const { previousLevel, newLevel } = await DbClient.addExp(c.env.DB, userId, EXP_STAGE_PASS);
      if (newLevel > previousLevel) {
        stageLevelUp = true;
        nextLevelName = CONFIG.getStageNameByLevel(newLevel);
      }
    }
  }

  let result: ReturnType<typeof calculateLocalQuiz> | null = null;
  const quizMeta = QUIZ_META[npcId as keyof typeof QUIZ_META];
  if (quizMeta) {
    result = calculateLocalQuiz(npcId, answers);
    if (result) {
      const existingHistory = await DbClient.getTestHistory(c.env.DB, userId, 1, 0);
      const isNewType = !existingHistory.some((h) => h.test_id === npcId);

      await DbClient.saveTestHistory(c.env.DB, {
        id: crypto.randomUUID(),
        userId,
        testId: npcId,
        testTitle: quizMeta.title,
        testType: quizMeta.type,
        resultCode: String(result.code),
        resultName: String(result.name),
        rawScores: JSON.stringify(result.scores ?? {}),
      });
      await DbClient.incrementCompleted(c.env.DB, userId, isNewType);
      await DbClient.addExp(c.env.DB, userId, EXP_QUIZ_COMPLETE);
    }
  }

  // 缓存失效：用户 Quiz 等级/经验发生变动，主动清除缓存，保证下次拿取最新快照
  await CacheService.delete(c.env.CACHE_KV, `user:quiz:${userId}`);

  TraceLogger.info('QUIZ', 'SUBMIT_ANSWERS', traceId, `用户提交试题解答成功 npc=${npcId}, 分数=${score}`, userId);

  return c.json({
    code: 200, message: 'success',
    data: { score, total, passed: score >= total * QUIZ_PASS_THRESHOLD, result, levelUp: stageLevelUp, nextLevelName, historyId: stageHistoryId },
    traceId,
  });
});

// ═════════════════════════════════════
// 测评历史
// ═════════════════════════════════════
app.get('/api/v1/quiz/test-history', async (c) => {
  const userId = c.get('userId');
  const traceId = c.get('traceId');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), TEST_HISTORY_MAX_LIMIT);
  const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);

  try {
    const list = await DbClient.getTestHistory(c.env.DB, userId, limit, offset);
    return c.json({ code: 200, message: 'success', data: list, traceId });
  } catch (error: any) {
    TraceLogger.error('QUIZ', 'GET_HISTORY_FAILED', traceId, `获取测评历史异常: ${error.message || error}`, error, userId);
    return c.json({ code: 500, message: '获取评测历史失败', traceId }, 500);
  }
});

// ═════════════════════════════════════
// 获取单条测评历史
// ═════════════════════════════════════
app.get('/api/v1/quiz/test-history/:id', async (c) => {
  const userId = c.get('userId');
  const traceId = c.get('traceId');
  const historyId = c.req.param('id');

  try {
    const list = await DbClient.getTestHistory(c.env.DB, userId, 100, 0);
    const record = list.find((h) => h.id === historyId);
    if (!record) {
      return c.json({ code: 404, message: '未找到该记录', traceId }, 404);
    }
    return c.json({ code: 200, message: 'success', data: record, traceId });
  } catch (error: any) {
    TraceLogger.error('QUIZ', 'GET_HISTORY_RECORD_FAILED', traceId, `获取单条评测记录异常: ${error.message || error}`, error, userId);
    return c.json({ code: 500, message: '获取历史记录异常', traceId }, 500);
  }
});

// ═════════════════════════════════════
// 删除单条历史
// ═════════════════════════════════════
app.delete('/api/v1/quiz/test-history/:id', async (c) => {
  const userId = c.get('userId');
  const traceId = c.get('traceId');
  const historyId = c.req.param('id');

  try {
    const deleted = await DbClient.deleteTestHistory(c.env.DB, historyId, userId);
    if (!deleted) {
      return c.json({ code: 404, message: '未找到该记录或无权限删除', traceId }, 404);
    }
    return c.json({ code: 200, message: 'success', data: null, traceId });
  } catch (error: any) {
    TraceLogger.error('QUIZ', 'DELETE_HISTORY_FAILED', traceId, `删除测评历史异常: ${error.message || error}`, error, userId);
    return c.json({ code: 500, message: '删除历史记录失败', traceId }, 500);
  }
});

// ═════════════════════════════════════
// 纯测评计算（不入闯关系统）
// ═════════════════════════════════════
app.post('/api/v1/quiz/calculate', async (c) => {
  const userId = c.get('userId');
  const traceId = c.get('traceId');

  const body = await c.req.json<{ testId?: string; answers?: AnswerSubmit[] }>();
  const { testId, answers } = body;
  if (!testId || !answers || !Array.isArray(answers) || answers.length === 0) {
    return c.json({ code: 400, message: '参数错误：testId 和 answers 不能为空', traceId }, 400);
  }

  const quizMeta = QUIZ_META[testId as keyof typeof QUIZ_META];
  if (!quizMeta) {
    return c.json({ code: 404, message: '找不到指定的题库', traceId }, 404);
  }

  const result = calculateLocalQuiz(testId, answers);
  if (!result) {
    return c.json({ code: 400, message: '测评计算失败', traceId }, 400);
  }

  try {
    const existingHistory = await DbClient.getTestHistory(c.env.DB, userId, 1, 0);
    const isNewType = !existingHistory.some((h) => h.test_id === testId);
    
    await DbClient.saveTestHistory(c.env.DB, {
      id: crypto.randomUUID(),
      userId,
      testId,
      testTitle: quizMeta.title,
      testType: quizMeta.type,
      resultCode: String(result.code),
      resultName: String(result.name),
      rawScores: JSON.stringify(result.scores ?? {}),
    });
    
    await DbClient.incrementCompleted(c.env.DB, userId, isNewType);
    await DbClient.addExp(c.env.DB, userId, EXP_QUIZ_CALCULATE);

    // 缓存失效
    await CacheService.delete(c.env.CACHE_KV, `user:quiz:${userId}`);

    TraceLogger.info('QUIZ', 'CALCULATE_TEST', traceId, `纯测评计算成功 testId=${testId}`, userId);
    return c.json({ code: 200, message: 'success', data: result, traceId });
  } catch (error: any) {
    TraceLogger.error('QUIZ', 'CALCULATE_TEST_FAILED', traceId, `纯评测计算落库异常: ${error.message || error}`, error, userId);
    return c.json({ code: 500, message: '测评结果处理异常', traceId }, 500);
  }
});

// ─── 全局错误处理 ───
app.onError((err, c) => {
  const traceId = c.get('traceId') || crypto.randomUUID();
  TraceLogger.error('QUIZ', 'UNCAUGHT_EXCEPTION', traceId, `服务未捕获异常: ${err.message || err}`, err, c.get('userId'));
  return c.json({
    code: 500,
    message: '系统繁忙，请稍后再试',
    traceId,
  }, 500);
});

export default app;
