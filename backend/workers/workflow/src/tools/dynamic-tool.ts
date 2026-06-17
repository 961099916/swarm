// File: /Users/zhangjiahao/IdeaProjects/swarm/backend/workers/workflow/src/tools/dynamic-tool.ts

import { BaseWorkflowTool } from "./base";
import { ToolContext, InputField } from "./types";
import { DynamicToolRow, TraceLogger } from "@swarm/shared";

function validateSafeUrl(urlStr: string): void {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error("URL 格式不合法");
  }

  const host = url.hostname.toLowerCase();
  
  if (host === "localhost" || host === "localhost.localdomain" || host === "::1" || host === "0.0.0.0") {
    throw new Error("安全策略限制：禁止访问内网或环回地址 (SSRF)");
  }

  const ipv4PrivateRegex = /^(?:127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/;
  if (ipv4PrivateRegex.test(host)) {
    throw new Error("安全策略限制：禁止访问私有内网 IP 网段 (SSRF)");
  }

  if (host.startsWith("fe80:") || host.startsWith("fc00:") || host.startsWith("fd00:")) {
    throw new Error("安全策略限制：禁止访问 IPv6 链路本地或私有单播地址 (SSRF)");
  }
}

export class DynamicWorkflowTool extends BaseWorkflowTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: InputField[];
  private rawConfig: DynamicToolRow;

  constructor(row: DynamicToolRow) {
    super();
    this.name = row.name;
    this.description = row.description;
    const paramsSchemaRaw = row.paramsSchema ?? (row as any).params_schema;
    try {
      if (typeof paramsSchemaRaw === "string") {
        this.inputSchema = JSON.parse(paramsSchemaRaw);
      } else if (Array.isArray(paramsSchemaRaw)) {
        this.inputSchema = paramsSchemaRaw;
      } else {
        this.inputSchema = [];
      }
    } catch (e: any) {
      TraceLogger.error("WORKFLOW", "TOOL_INIT_FAILED", "SYSTEM_INIT", `动态工具 ${row.name} 解析 paramsSchema 异常: ${e.message}`, e);
      this.inputSchema = [];
    }
    this.rawConfig = row;
  }

  protected validate(input: any): void {
    if (!input || typeof input !== "object") {
      throw new Error("工具输入参数无效，必须是 JSON 对象");
    }
    for (const field of this.inputSchema) {
      const val = input[field.name];
      if (field.required && (val === undefined || val === null || val === "")) {
        throw new Error(`缺少必填参数: ${field.name}`);
      }
      if (val !== undefined && val !== null && val !== "") {
        const actualType = typeof val;
        if (field.type === "number" && actualType !== "number" && isNaN(Number(val))) {
          throw new Error(`参数 ${field.name} 应为 number 类型，实际为 ${actualType}`);
        }
        if (field.type === "boolean" && actualType !== "boolean") {
          if (val !== "true" && val !== "false" && val !== true && val !== false) {
            throw new Error(`参数 ${field.name} 应为 boolean 类型，实际为 ${actualType}`);
          }
        }
      }
    }
  }

  protected async run(input: any, ctx: ToolContext): Promise<string> {
    const traceId = ctx.traceId || "DYNAMIC_TOOL_RUN";
    
    if (this.rawConfig.script && this.rawConfig.script.trim()) {
      return await this.runScriptMode(input, ctx, traceId);
    }
    
    if (this.rawConfig.endpoint && this.rawConfig.endpoint.trim()) {
      return await this.runApiProxyMode(input, ctx, traceId);
    }

    throw new Error(`[ERROR] [TraceID: ${traceId}] 动态工具 ${this.name} 配置无效: 缺少 script 或 endpoint`);
  }

  /**
   * 1. 动态脚本运行模式 (FaaS 沙箱模式)
   */
  private async runScriptMode(input: any, ctx: ToolContext, traceId: string): Promise<string> {
    const code = this.rawConfig.script!;
    
    // 🛡️ 静态安全过滤：阻断恶意死循环与全局作用域污染
    const blacklistedPatterns = [
      /while\s*\(\s*true\s*\)/gi,
      /for\s*\(\s*;\s*;\s*\)/gi,
      /globalThis/g,
      /process/g,
      /eval/g,
      /Function/g
    ];

    for (const pattern of blacklistedPatterns) {
      if (pattern.test(code)) {
        TraceLogger.warn("WORKFLOW", "DYNAMIC_SCRIPT_BLOCKED", traceId, `安全拦截：检测到敏感关键字或死循环特征 (${pattern.source})`);
        throw new Error(`安全策略拦截：动态脚本中包含了被禁用的敏感关键字或潜在的死循环特征 (${pattern.source})`);
      }
    }
    
    const safeEnv = {
      EMAIL_FROM: ctx.env.EMAIL_FROM,
      AI: ctx.env.AI,
    };

    const runContext = {
      traceId,
      env: safeEnv,
    };

    TraceLogger.info("WORKFLOW", "TOOL_SCRIPT_RUN", traceId, `启动动态 JS 脚本执行: tool=${this.name}`);

    try {
      const runFn = new Function("input", "context", `
        ${code}
        if (typeof run !== 'function') {
          throw new Error("动态脚本中必须声明 async function run(input, context) 作为主入口");
        }
        return run(input, context);
      `);

      const executionPromise = runFn(input, runContext);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("动态脚本执行超时 (限制 15 秒)")), 15000)
      );

      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      if (typeof result === "string") {
        return result;
      }
      return JSON.stringify(result);
    } catch (err: any) {
      let errorMsg = err.message || String(err);
      if (errorMsg.includes("disallowed for this context") || errorMsg.includes("EvalError")) {
        errorMsg = `[Cloudflare 安全隔离限制] 当前部署运行在 Cloudflare Workers 生产环境，平台出于安全考虑禁用了运行时动态 JS 脚本执行机制。请在此工具的配置中将其修改为【API 代理模式】（No-Code 模式）运行。`;
      }
      TraceLogger.error("WORKFLOW", "TOOL_SCRIPT_ERROR", traceId, `动态脚本执行期异常: ${errorMsg}`, err);
      throw new Error(`动态脚本执行异常: ${errorMsg}`);
    }
  }

  /**
   * 2. 声明式 API 代理模式 (No-Code)
   */
  private async runApiProxyMode(input: any, ctx: ToolContext, traceId: string): Promise<string> {
    let url = this.rawConfig.endpoint!;
    const method = this.rawConfig.method || "GET";
    const headersStr = this.rawConfig.headers || "{}";
    const bodyTemplate = this.rawConfig.bodyTemplate ?? (this.rawConfig as any).body_template;

    TraceLogger.info("WORKFLOW", "TOOL_API_PROXY", traceId, `启动声明式 API 代理请求: ${method} ${url.slice(0, 100)}`);

    for (const key of Object.keys(input)) {
      const val = String(input[key]);
      url = url.replace(new RegExp(`{{${key}}}`, "g"), val);
    }
    
    url = url.replace(/[&?][^=&]+={{[^}]+}}/g, "");
    url = url.replace(/{{[^}]+}}/g, "");

    // 🛡️ SSRF 拦截检测
    try {
      validateSafeUrl(url);
    } catch (ssrfErr: any) {
      TraceLogger.error("WORKFLOW", "SSRF_BLOCKED", traceId, `安全拦截：API 代理触发内网 SSRF 规则，目标: ${url}`, ssrfErr);
      throw ssrfErr;
    }

    let headers: Record<string, string> = {};
    try {
      headers = typeof headersStr === "string" ? JSON.parse(headersStr) : headersStr;
    } catch (e: any) {
      TraceLogger.error("WORKFLOW", "TOOL_HEADERS_PARSE_ERROR", traceId, `解析 headers JSON 异常: ${e.message}`, e);
    }

    let body: any = null;
    if (bodyTemplate && method !== "GET") {
      let resolvedBody = bodyTemplate;
      for (const key of Object.keys(input)) {
        resolvedBody = resolvedBody.replace(new RegExp(`{{${key}}}`, "g"), String(input[key]));
      }
      body = resolvedBody;
    }

    // 设置 10 秒超时阻断
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: method !== "GET" ? body : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`外部接口返回 HTTP ${res.status}`);
      }

      // 🛡️ OOM 内存防溢出流分块硬限制：最大 5MB 响应体拦截，防止打爆 Worker 内存
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("无法获取外部响应体流");
      }

      let totalBytes = 0;
      const chunks: Uint8Array[] = [];
      const MAX_BYTES = 5 * 1024 * 1024; // 5MB limit

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > MAX_BYTES) {
            throw new Error("响应数据超出了系统最大接收限制 (5MB)，安全熔断阻断以防 OOM");
          }
          chunks.push(value);
        }
      }

      // 将 chunk 数据重构为文本
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      const unifiedArray = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        unifiedArray.set(chunk, offset);
        offset += chunk.length;
      }

      const responseText = new TextDecoder("utf-8").decode(unifiedArray);

      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        return responseText;
      }

      const responseSelector = this.rawConfig.responseSelector ?? (this.rawConfig as any).response_selector;
      if (responseSelector && responseSelector.trim()) {
        const selector = responseSelector.trim();
        const keys = selector.split(".");
        let currentVal = responseData;
        for (const k of keys) {
          if (currentVal && currentVal[k] !== undefined) {
            currentVal = currentVal[k];
          } else {
            currentVal = null;
            break;
          }
        }
        if (currentVal === null || currentVal === undefined) {
          TraceLogger.warn("WORKFLOW", "TOOL_SELECTOR_EMPTY", traceId, `路径过滤器 ${selector} 未提取到有效内容`);
          return responseText;
        }
        return typeof currentVal === "string" ? currentVal : JSON.stringify(currentVal);
      }

      return typeof responseData === "string" ? responseData : JSON.stringify(responseData);
    } catch (err: any) {
      clearTimeout(timeoutId);
      TraceLogger.error("WORKFLOW", "TOOL_PROXY_FAILED", traceId, `API 代理请求错误: ${err.message}`, err);
      throw new Error(`API代理调用异常: ${err.message}`);
    }
  }
}
