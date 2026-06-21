// File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/utils/request.ts

import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// 扩展 AxiosRequestConfig，添加重试次数的自定义选项
interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retryCount?: number;
}

// 对应系统网关环境变量的 API 基础路径，默认指向线上网关地址
const BASE_API_URL = import.meta.env.VITE_API_URL || 'https://swarm-gateway.961099916.workers.dev';

const request: AxiosInstance = axios.create({
  baseURL: BASE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 最大重试次数与重试间隔延迟时间（毫秒）
const MAX_RETRY_LIMIT = 3;
const RETRY_DELAY_BASE_MS = 1000;

// UUID v4 生成辅助函数，保证前端每次请求具有独立 TraceID
function generateUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ──────────────────────────────────────────────────
// Request 拦截器：生成 TraceID，注入 Authorization Header
// ──────────────────────────────────────────────────
request.interceptors.request.use(
  (config) => {
    // 注入 TraceID，与后端可观测性 MDC 对齐
    const traceId = generateUUID();
    config.headers = config.headers || {};
    config.headers['X-Trace-Id'] = traceId;

    // 获取并注入本地存储的管理员 Bearer Token
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// File: /Users/zhangjiahao/IdeaProjects/swarm/frontend/admin/src/utils/request.ts
// ──────────────────────────────────────────────────
// Response 拦截器：统一鉴权失效拦截与 GET 接口幂等重试机制
// ──────────────────────────────────────────────────
request.interceptors.response.use(
  (response: AxiosResponse) => {
    const resData = response.data;
    if (resData && typeof resData === 'object') {
      // 动态适配契约，将 code===0 映射为 success 标记以符合前端统一调用
      resData.success = resData.code === 0;
      if (resData.code !== 0) {
        resData.error = resData.message || '业务请求失败';
      }
    }

    if (resData && resData.success === false) {
      const traceId = response.config?.headers?.['X-Trace-Id'] || 'unknown';
      const errMsg = resData.error || resData.message || '业务请求失败';
      return Promise.reject(new Error(`${errMsg} (TraceID: ${traceId})`));
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as CustomAxiosRequestConfig;
    const status = error.response ? error.response.status : null;

    // 1. 拦截 401 (未授权 / Token 过期) 并清理状态重定向登录
    if (status === 401) {
      console.warn('[Request] 登录凭证无效或过期，强制清理状态并跳转。');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      
      // 如果当前不是在登录页，则进行强制重定向
      if (!window.location.hash.includes('/login') && !window.location.pathname.includes('/login')) {
        window.location.href = '/#/login';
      }
      return Promise.reject(new Error('登录凭证已失效，请重新登录'));
    }

    // 2. 拦截 403 (权限不足)
    if (status === 403) {
      console.error('[Request] 权限不足，被网关或子服务拦截。');
      const traceId = config?.headers?.['X-Trace-Id'] || 'unknown';
      return Promise.reject(new Error(`权限不足：您无权执行管理员操作 (TraceID: ${traceId})`));
    }

    // 3. 对 GET 等幂等接口实施自动指数退避重试 (防网络闪断)
    const isIdempotentMethod = config && config.method && config.method.toUpperCase() === 'GET';
    if (isIdempotentMethod && config) {
      config._retryCount = config._retryCount || 0;

      if (config._retryCount < MAX_RETRY_LIMIT) {
        config._retryCount += 1;
        const delay = RETRY_DELAY_BASE_MS * Math.pow(2, config._retryCount - 1);
        console.warn(`[Request] GET 请求异常 (Status: ${status || '网络故障'}). 发起第 ${config._retryCount} 次重试，延时 ${delay}ms...`);
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        return request(config);
      }
    }

    // 4. 其他类型异常，抛出错误提示
    const traceId = config?.headers?.['X-Trace-Id'] || 'unknown';
    const errData = error.response?.data as { error?: string; message?: string } | undefined;
    const errorMsg = errData?.message || errData?.error || error.message;

    return Promise.reject(new Error(`${errorMsg || '网络请求错误，请稍后重试'} (TraceID: ${traceId})`));
  }
);

export default request;
