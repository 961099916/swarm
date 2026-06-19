# 错误处理策略

- **状态**: ✅ 已实施
- **日期**: 2026-06-17
- **决策者**: @jiuxia

## 背景

项目初始代码中大量使用 `catch (error: any)` 和 `error.message || error` 模式，违反了 TypeScript strict 模式约定，且不安全（`error` 可能不是 Error 实例）。

## 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **A: getErrorMessage() 工具函数** | ✅ 统一安全地提取错误消息；支持 Error/string/object | 需要额外 import |
| **B: 强制 instanceof 检查** | ✅ 类型安全 | 代码冗余，15+ 行样板代码 |
| **C: 升级 TypeScript 5.x 的 `unknown` 内置处理** | 原生支持 | TS 5.x 才支持，需要升级 |

## 决策

选择**方案 A**：
1. 创建 `getErrorMessage()`、`getErrorStack()`、`errorIncludes()` 三个工具函数
2. 所有 `catch (error: any)` 替换为 `catch (error: unknown)`
3. `error.message` 替换为 `getErrorMessage(error)`

## 后果

- ✅ 56 处 `catch(error: any)` 全部消除
- ✅ 错误消息提取统一安全
- ✅ 新代码可直接使用工具函数
