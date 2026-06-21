/**
 * TraceLogger 单元测试
 *
 * 验证：结构化日志格式、敏感字段脱敏、分级输出
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceLogger } from '../src/logger';

describe('TraceLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('info', () => {
    it('应输出 JSON 格式的结构化日志', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      TraceLogger.info('TEST', 'EVENT', 'trace-123', '测试消息', 'user-1', { key: 'value' });

      expect(spy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(spy.mock.calls[0][0]);
      expect(payload).toMatchObject({
        level: 'INFO',
        module: 'TEST',
        event: 'EVENT',
        traceId: 'trace-123',
        message: '测试消息',
        userId: 'user-1',
        payload: { key: 'value' },
      });
      expect(payload.timestamp).toBeDefined();
      expect(() => new Date(payload.timestamp)).not.toThrow();
    });
  });

  describe('error', () => {
    it('应在 ERROR 级别包含 exception 信息', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const err = new Error('测试异常');
      TraceLogger.error('TEST', 'ERR', 'trace-456', '出错了', err, 'user-2');

      expect(spy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(spy.mock.calls[0][0]);
      expect(payload.level).toBe('ERROR');
      expect(payload.exception).toMatchObject({
        message: '测试异常',
      });
      expect(payload.exception.stack).toBeDefined();
    });
  });

  describe('warn', () => {
    it('应输出到 console.warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      TraceLogger.warn('TEST', 'WARN_EVT', 'trace-789', '警告消息');
      expect(spy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(spy.mock.calls[0][0]);
      expect(payload.level).toBe('WARN');
    });
  });

  describe('debug', () => {
    it('应输出到 console.log', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      TraceLogger.debug('TEST', 'DBG', 'trace-debug', '调试消息');
      expect(spy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(spy.mock.calls[0][0]);
      expect(payload.level).toBe('DEBUG');
    });
  });

  describe('敏感字段脱敏', () => {
    it('应脱敏 password 字段', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      TraceLogger.info('TEST', 'LOGIN', 'trace-sec', '用户登录', undefined, {
        username: 'test',
        password: 'my-secret-123',
        token: 'jwt-xxx',
      });

      const payload = JSON.parse(spy.mock.calls[0][0]);
      expect(payload.payload.password).toBe('***REDACTED***');
      expect(payload.payload.token).toBe('***REDACTED***');
      expect(payload.payload.username).toBe('test');
    });

    it('应脱敏 wx_open_id 和 session_key', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      TraceLogger.info('TEST', 'WX_LOGIN', 'trace-wx', '微信登录', undefined, {
        wx_open_id: 'oabc123',
        session_key: 'session-xxx',
        nickname: '小明',
      });

      const payload = JSON.parse(spy.mock.calls[0][0]);
      expect(payload.payload.wx_open_id).toBe('***REDACTED***');
      expect(payload.payload.session_key).toBe('***REDACTED***');
      expect(payload.payload.nickname).toBe('小明');
    });

    it('应递归脱敏嵌套对象中的敏感字段', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      TraceLogger.info('TEST', 'NESTED', 'trace-nest', '嵌套对象', undefined, {
        user: {
          openid: 'o-xxx',
          email: 'test@example.com',
        },
      });

      const payload = JSON.parse(spy.mock.calls[0][0]);
      expect(payload.payload.user.openid).toBe('***REDACTED***');
      expect(payload.payload.user.email).toBe('test@example.com');
    });
  });
});
