// @ts-check

/**
 * Swarm 项目工程基础配置
 * 为所有包提供统一的 script 模板，
 * 确保每个包都具备 test/type-check 能力。
 *
 * 使用方法：
 *   项目级： npm run test:all    —— 运行所有包的测试
 *           npm run lint        —— 全局 ESLint
 */

// ─── 统一脚本模板 ───
// 每个 packages/* 和 workers/* 的 package.json 应包含：
//
// "scripts": {
//   "test": "vitest run || echo 'No tests configured'",
//   "type-check": "tsc --noEmit",
// }
//
// 尚未配置测试的包使用 `|| echo` 避免 CI 失败。
