/**
 * ErrorCode 与 ApiRes 单元测试
 *
 * 验证：错误码定义、HTTP 状态码映射、统一响应格式
 */
import { describe, it, expect } from 'vitest';
import { ErrorCode, errorCodeToHttpStatus } from '../src/error-code';
import { ApiRes } from '../src/api-response';

describe('ErrorCode', () => {
  it('0 表示成功', () => {
    expect(ErrorCode.OK).toBe(0);
  });

  it('通用错误码在 1000-1999 范围内', () => {
    expect(ErrorCode.BAD_REQUEST).toBe(1000);
    expect(ErrorCode.VALIDATION_ERROR).toBe(1001);
    expect(ErrorCode.UNAUTHORIZED).toBe(1010);
    expect(ErrorCode.TOKEN_EXPIRED).toBe(1011);
    expect(ErrorCode.TOKEN_INVALID).toBe(1012);
    expect(ErrorCode.FORBIDDEN).toBe(1020);
    expect(ErrorCode.NOT_FOUND).toBe(1030);
    expect(ErrorCode.CONFLICT).toBe(1040);
    expect(ErrorCode.RATE_LIMITED).toBe(1050);
    expect(ErrorCode.SERVICE_UNAVAILABLE).toBe(1060);
    expect(ErrorCode.INTERNAL).toBe(1999);
  });

  it('业务错误码在各自范围内', () => {
    expect(ErrorCode.USER_NOT_FOUND).toBe(2001);
    expect(ErrorCode.USER_BANNED).toBe(2002);
    expect(ErrorCode.INSUFFICIENT_CREDITS).toBe(2100);
    expect(ErrorCode.AI_MODEL_UNAVAILABLE).toBe(3000);
  });
});

describe('errorCodeToHttpStatus', () => {
  it('OK 映射 200', () => expect(errorCodeToHttpStatus(0)).toBe(200));
  it('验证错误映射 400', () => expect(errorCodeToHttpStatus(1000)).toBe(400));
  it('Token 错误映射 401', () => expect(errorCodeToHttpStatus(1010)).toBe(401));
  it('禁止访问映射 403', () => expect(errorCodeToHttpStatus(1020)).toBe(403));
  it('未找到映射 404', () => expect(errorCodeToHttpStatus(1030)).toBe(404));
  it('冲突映射 409', () => expect(errorCodeToHttpStatus(1040)).toBe(409));
  it('限速映射 429', () => expect(errorCodeToHttpStatus(1050)).toBe(429));
  it('服务不可用映射 503', () => expect(errorCodeToHttpStatus(1060)).toBe(503));
  it('其他错误默认映射 500', () => expect(errorCodeToHttpStatus(9999)).toBe(500));
});

describe('ApiRes', () => {
  const traceId = 'test-trace-id';

  describe('success', () => {
    it('应返回 200 + 标准成功格式', async () => {
      const res = ApiRes.success({ id: '1' }, traceId);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        code: 0,
        message: 'ok',
        data: { id: '1' },
        traceId,
      });
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('error', () => {
    it('应返回正确的 HTTP 状态码 + 业务错误码', async () => {
      const res = ApiRes.error(ErrorCode.NOT_FOUND, '用户不存在', traceId);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        code: ErrorCode.NOT_FOUND,
        message: '用户不存在',
        traceId,
      });
    });
  });

  describe('便捷方法', () => {
    it('badRequest', async () => {
      const res = ApiRes.badRequest('参数错误', traceId);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe(ErrorCode.BAD_REQUEST);
    });

    it('unauthorized', async () => {
      const res = ApiRes.unauthorized('请登录', traceId);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it('forbidden', async () => {
      const res = ApiRes.forbidden('无权操作', traceId);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe(ErrorCode.FORBIDDEN);
    });

    it('notFound', async () => {
      const res = ApiRes.notFound('资源不存在', traceId);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('internalError', async () => {
      const res = ApiRes.internalError('系统繁忙', traceId);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.code).toBe(ErrorCode.INTERNAL);
    });
  });

  describe('paginated', () => {
    it('应包含分页元数据', async () => {
      const res = ApiRes.paginated([1, 2, 3], { page: 1, pageSize: 10, total: 3, totalPages: 1 }, traceId);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pagination).toEqual({ page: 1, pageSize: 10, total: 3, totalPages: 1 });
    });
  });
});
