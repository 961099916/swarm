# ADR: Sass 现代编译器及 @use 语法升级决策

## 上下文
控制台在小程序构建期输出大量的 Sass `@import` 及 `legacy-js-api` 弃用警告。由于我们在 `vite.config.ts` 中为了临时兼容采用了 `additionalData: @import` 并在每个组件中强制注入，导致多模块打包时变量名重复定义冲突，且无法使用现代 Sass 编译流。

## 决策
1. **升级为现代编译器 (Modern Compiler)**：将 `vite.config.ts` 中 scss 的 `api` 配置改回 `"modern-compiler"`，并彻底移除全局 `additionalData` 变量强制注入。
2. **显式精准导入**：不再采用全局静默粗暴注入，而由各组件根据自身需要精确声明 `@use "@/uni.scss" as *;`。

## 影响
- 彻底消除了编译终端中的所有 `Sass @import` 及 `legacy-js-api` 弃用警告，使终端输出极其干净。
- 架构对齐未来的 Sass 3.0 规范，保证项目的可持续演进。
