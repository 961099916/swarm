/**
 * 业务常量定义
 *
 * 将散布在代码中的魔法值集中管理，所有 worker 共享同一份常量。
 * 修改业务规则时仅需修改此文件，避免遗漏。
 */

// ══════════════════════════════════════════════════
// 积分系统
// ══════════════════════════════════════════════════

/** 新用户注册赠送积分 */
export const INITIAL_CREDITS = 50;

/** 邀请奖励积分 */
export const INVITE_REWARD = 50;

/** 广告激励积分 */
export const AD_REWARD = 20;

/** 创建任务消耗积分 */
export const TASK_COST = 5;

// ══════════════════════════════════════════════════
// 认证与 Token
// ══════════════════════════════════════════════════

/** JWT 过期天数 */
export const TOKEN_EXPIRY_DAYS = 7;

/** JWT 过期秒数 (计算后) */
export const TOKEN_EXPIRY_SECONDS = TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

// ══════════════════════════════════════════════════
// 分页
// ══════════════════════════════════════════════════

/** 后台管理列表默认每页条数 */
export const DEFAULT_PAGE_LIMIT = 20;

/** 积分流水默认每页条数 */
export const CREDITS_LIMIT = 50;

// ══════════════════════════════════════════════════
// 工作流引擎
// ══════════════════════════════════════════════════

/** 多智能体协作默认最大轮数 */
export const DEFAULT_MAX_LOOPS = 5;

/** Supervisor 决策保留最近 N 轮记忆 */
export const MEMORY_RECENT_COUNT = 6;

/** Agent 推理保留最近 N 轮上下文 */
export const MEMORY_AGENT_COUNT = 4;

// ══════════════════════════════════════════════════
// 测评系统
// ══════════════════════════════════════════════════

/** 每级所需经验值 */
export const EXP_PER_LEVEL = 100;

/** 关卡通过阈值 (分数占比) */
export const QUIZ_PASS_THRESHOLD = 0.6;

/** 通过关卡奖励经验 */
export const EXP_STAGE_PASS = 20;

/** 完成测评奖励经验 */
export const EXP_QUIZ_COMPLETE = 10;

/** 纯测评计算奖励经验 */
export const EXP_QUIZ_CALCULATE = 5;

/** 测评历史列表最大返回条数 */
export const TEST_HISTORY_MAX_LIMIT = 200;
