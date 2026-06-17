/**
 * ESLint 配置 — Swarm 项目
 *
 * 参考规范:
 *  - 阿里巴巴前端规约 (TypeScript)
 *  - ESLint recommended rules
 *  - @typescript-eslint recommended
 */

module.exports = {
  root: true,
  env: {
    es2022: true,
    browser: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    // ─── 代码风格 — 阿里巴巴规约核心 ───
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-console": "off", // 微信小程序/Workers 环境下 console 是主要日志手段
    "no-debugger": "warn",
    "no-duplicate-imports": "error",
    "no-var": "error",
    "prefer-const": "error",
    "no-undef-init": "error",
    "no-unneeded-ternary": "error",
    "prefer-template": "warn",

    // ─── 安全性 ───
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",

    // ─── 最佳实践 ───
    "eqeqeq": ["error", "always", { null: "ignore" }],
    "no-caller": "error",
    "no-extra-bind": "error",
    "no-floating-decimal": "error",
    "no-lone-blocks": "error",
    "no-multi-spaces": "error",
    "no-new-wrappers": "error",
    "no-octal-escape": "error",
    "no-proto": "error",
    "no-return-await": "warn",
    "no-self-compare": "error",
    "no-throw-literal": "error",
    "no-useless-call": "error",
    "no-useless-computed-key": "error",
    "no-useless-concat": "error",
    "no-useless-escape": "warn",
    "no-useless-rename": "error",
    "require-atomic-updates": "warn",
    "yoda": "error",
  },
  overrides: [
    // ─── TypeScript 文件 ───
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: [
          "backend/workers/gateway/tsconfig.json",
          "backend/workers/admin/tsconfig.json",
          "backend/workers/workflow/tsconfig.json",
          "backend/workers/quiz/tsconfig.json",
        ],
      },
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
      ],
      plugins: ["@typescript-eslint"],
      rules: {
        // 严格空值检查
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-non-null-assertion": "warn",
        "@typescript-eslint/prefer-optional-chain": "warn",
        "@typescript-eslint/prefer-nullish-coalescing": "warn",
        "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],

        // 阿里巴巴 TypeScript 规约
        "@typescript-eslint/no-require-imports": "error",
        "@typescript-eslint/no-for-in-array": "error",
        "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      },
    },
    // ─── JSON 文件 ───
    {
      files: ["*.json"],
      rules: {
        "no-unused-expressions": "off",
      },
    },
  ],
  ignorePatterns: [
    "node_modules/",
    "miniprogram_npm/",
    ".npm-cache/",
    "dist/",
    "build/",
    ".wrangler/",
    ".codegraph/",
    ".mimocode/",
    "*.sqlite*",
    "*.min.js",
  ],
};
