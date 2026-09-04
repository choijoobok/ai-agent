import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient } from '@/shared/api/client';
import { request } from '@/shared/api/request';
import { ApiError, TRANSPORT_ERROR_CODE } from '@/shared/api/types';

/**
 * 봉투 처리 — api-conventions.md §2.3.
 *
 * <p>여기서 지키려는 것은 <b>화면이 실패를 한 가지 모양으로만 만난다</b>는 것이다. 서버가
 * 401 봉투를 주든, 프록시가 HTML 을 주든, 네트워크가 끊기든 화면은 {@link ApiError} 하나만
 * 다루면 된다.
 */
describe('request', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockResponse(data: unknown, status = 200) {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data,
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
  }

  it('성공 봉투에서 data 만 꺼낸다', async () => {
    mockResponse({ success: true, data: { userId: 'admin' }, traceId: 't-1' });

    await expect(request({ url: '/x' })).resolves.toEqual({ userId: 'admin' });
  });

  it('실패 봉투는 ApiError 로 던진다 — 서버가 완성한 문구를 그대로 나른다', async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(
      new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
        data: {
          success: false,
          code: 'err.login.failed',
          message: '아이디 또는 비밀번호가 올바르지 않습니다.',
          traceId: 't-2',
        },
        status: 401,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );

    const error = await request({ url: '/x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.code).toBe('err.login.failed');
    expect(apiError.message).toBe('아이디 또는 비밀번호가 올바르지 않습니다.');
    expect(apiError.status).toBe(401);
    expect(apiError.traceId).toBe('t-2');
  });

  it('봉투가 아닌 응답도 ApiError 가 된다 — 프록시가 HTML 을 돌려주는 경우', async () => {
    // 이것이 없으면 화면은 "<!doctype html> 을 JSON 으로 읽다 죽었다" 로 끝나고,
    // 그 원인이 응답 어디에도 남지 않는다.
    vi.spyOn(apiClient, 'request').mockRejectedValue(
      new AxiosError('Network Error', 'ERR_NETWORK'),
    );

    const error = (await request({ url: '/x' }).catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe(TRANSPORT_ERROR_CODE);
    expect(error.status).toBe(0);
  });

  it('2xx 인데 success:false 면 실패로 다룬다', async () => {
    // 상태 코드가 아니라 봉투가 첫 분기다. 둘이 어긋나도 화면이 성공으로 착각하지 않아야 한다.
    mockResponse({ success: false, code: 'err.internal', message: '오류' }, 200);

    const error = (await request({ url: '/x' }).catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('err.internal');
  });
});
