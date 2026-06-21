// File: packages/quiz/src/index.ts
/**
 * @swarm/quiz — 评测经济与成长限界上下文
 *
 * Bounded Context (DDD): 测评系统、导师挑战、经验等级体系
 * Aggregate Roots: QuizUser (评测用户聚合)
 */

export {
  quizUsers, testHistory, userStageProgress,
  systemConfigs, quizStages, quizNpcs, quizQuestions,
} from './infrastructure/db/schema';
export type {
  QuizUserRow, UserStageProgressRow, TestHistoryRow,
} from './types';
export { QuizConfig } from './constants';
