/**
 * @swarm/quiz — 测评评定限界上下文
 *
 * Bounded Context (DDD): 闯关测评、关卡配置、评分引擎、经验等级
 * Aggregate Roots: QuizUser (测评用户聚合)
 */

export { quizUsers, testHistory, userStageProgress, systemConfigs, quizStages, quizNpcs, quizQuestions } from './schema';
export type {
  QuizUserRow, TestHistoryRow, UserStageProgressRow,
} from './types';
export {
  EXP_PER_LEVEL, QUIZ_PASS_THRESHOLD,
  EXP_STAGE_PASS, EXP_QUIZ_COMPLETE, EXP_QUIZ_CALCULATE,
  TEST_HISTORY_MAX_LIMIT,
} from './constants';
