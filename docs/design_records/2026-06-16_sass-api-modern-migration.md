# ADR: SCSS 编译 API 升级为 modern 决策

## 上下文
控制台在小程序构建期仍残留 `legacy-js-api` 警告。即便在 `vite.config.ts` 中指定了 `modern-compiler`，老版适配层在某些编译依赖下依旧会采用遗留的 JS 接口导致警告生成。

## 决策
1. **升级至最新 api 规范**：将 `vite.config.ts` 中 scss 的 `api` 配置从 `"modern-compiler"` 更正为最现代、标准的 `"modern"`，彻底斩断对老的 Javascript Bridge 的底层调用。

## 影响
- 彻底斩断了老旧 API 的依赖，未来 Dart Sass 2.0.0 正式发布移除旧 API 时项目能零阻碍平滑过渡。
