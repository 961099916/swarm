# 架构决策记录 (ADR)：将天气查询工具迁移至 API 代理模式

* **状态**：已批准 (Approved)
* **日期**：2026-06-17
* **作者**：Antigravity (首席全栈架构师)
* **上下文 (Context)**：在多智能体工作流执行“郸城天气”任务时，由于 Cloudflare Workers 生产环境出于安全考虑禁用了运行时 JS 动态脚本执行（`new Function`），原有的 Script (FaaS) 运行模式抛出安全限制错误。为了规避此物理限制，需将 `weather_query` 工具改造为免代码的 **API 代理模式 (No-Code)**。

---

## 架构定位与控制流转

```
          [ 多智能体工作流引擎 ]
                   │
                   ▼ (调用 weather_query)
        [ DynamicWorkflowTool.run() ]
                   │ (检测到 script 为空，自动切换)
                   ▼
       [ API 代理模式 (No-Code) ]
                   │
                   ▼ (GET https://uapis.cn/api/v1/misc/weather?city=...)
             [ 天气 API 接口 ]
                   │
                   ▼ 返回标准 JSON 数据
         [ 天气查询助手 智能体 ]
                   │ (利用大模型解析 JSON 结构)
                   ▼
        格式化输出易读的天气自然语言
```

## 核心设计与数据变更

我们将修改 D1 数据库中 `weather_query` 工具的字段值，将其从脚本模式更改为声明式接口请求模式：

*   **`script`**：置为 `NULL` (清空 JS 脚本，从而触发进入 API 代理模式)
*   **`endpoint`**：设置为 `'https://uapis.cn/api/v1/misc/weather?city={{city}}&location={{location}}'`
*   **`method`**：设置为 `'GET'`
*   **`headers`**：设置为 `'{}'`
*   **`body_template`**：置为 `NULL`
*   **`response_selector`**：置为 `NULL`（原样返回 JSON 字符串，让大模型智能体读取后解析，保障扩展性）

---

## 防御设计：可选参数净化

由于工具带有可选参数（如 `location`），若调用时未传入，原本会导致 URL 中残留 `{{location}}` 占位符而引发外部 API 报错。
我们将在 `dynamic-tool.ts` 的 `runApiProxyMode` 中加入如下净化过滤逻辑：

```typescript
    // 占位符替换
    for (const key of Object.keys(input)) {
      const val = String(input[key]);
      url = url.replace(new RegExp(`{{${key}}}`, "g"), val);
    }
    
    // 正则净化：清理所有残留的可选参数占位符及其键值对
    url = url.replace(/[&?][^=&]+={{[^}]+}}/g, "");
    url = url.replace(/{{[^}]+}}/g, "");
```

---

## 评估与后果 (Consequences)

* **优点**：
  1. 彻底解决 Cloudflare Workers 下的 `new Function` 安全沙箱限制。
  2. 智能体可以更具弹性地读取完整的 JSON 结果，不需要在 JS 脚本中维护繁琐的排版逻辑，逻辑向智能体层进一步收拢。
* **影响**：如果数据库缓存未刷新，可能导致短期内仍读取到旧的脚本配置。因此在更新 SQL 后需要重新部署 Worker 强制冷启动。
