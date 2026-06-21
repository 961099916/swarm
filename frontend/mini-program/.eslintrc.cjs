/**
 * 前端 ESLint 配置 — 微信小程序专用规则
 *
 * 注意：前端代码全部为 JavaScript（CommonJS），
 * 不使用 TypeScript（待后续迁移）。
 *
 * extends 策略：
 *   - 不使用 @typescript-eslint（前端非 TS）
 *   - 不使用 eslint:recommended（太宽松）
 *   - 手动设置必要规则
 */
module.exports = {
  root: false, // 继承项目根配置
  env: {
    es2022: true,
    // 微信小程序全局变量
    wx: true,
    App: true,
    Page: true,
    Component: true,
    getApp: true,
    getCurrentPages: true,
  },
  globals: {
    // TDesign 组件库全局类型
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    // ─── 微信小程序特有规则 ───
    "no-restricted-globals": [
      "warn",
      { name: "fetch", message: "小程序请使用 wx.request" },
      { name: "alert", message: "小程序请使用 wx.showModal / wx.showToast" },
      { name: "document", message: "小程序无 DOM API" },
      { name: "window", message: "小程序无 Window API" },
      { name: "localStorage", message: "小程序请使用 wx.getStorageSync / wx.setStorageSync" },
    ],

    // ─── 代码质量 ───
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-console": "off",
    "no-var": "error",
    "prefer-const": "error",
    "eqeqeq": ["error", "always", { null: "ignore" }],
    "no-eval": "error",

    // ─── 最佳实践 ───
    "no-duplicate-imports": "error",
    "no-useless-escape": "warn",
  },
};
