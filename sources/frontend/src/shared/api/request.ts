import { AxiosError, type AxiosRequestConfig } from 'axios';
import { apiClient } from '@/shared/api/client';
import { ApiError, TRANSPORT_ERROR_CODE, type ApiEnvelope } from '@/shared/api/types';
import { staticText } from '@/locales/staticText';

/**
 * 봉투를 벗겨 알맹이를 주거나 {@link ApiError} 로 던진다 — backend/api.md.
 *
 * <p>인터셉터에서 벗기지 않는 이유는 <b>성공 응답에도 traceId 가 있기</b> 때문이다.
 * 인터셉터가 `response.data = data` 로 갈아치우면 그 값이 사라지고, 나중에 필요해질 때
 * 모든 호출부가 바뀐다.
 *
 * <p><b>401 을 여기서 처리하지 않는다.</b> 규약은 재인증 모달이고(frontend/packages.md · backend/session.md) 그것은
 * 셸 위에 뜨는 UI 다 — 띄울 셸이 없는 지금 로그아웃으로 대신하면, 셸이 생길 때 그 임시
 * 처리를 찾아 지워야 한다. 상태를 실어 보내고 판단은 호출부에 둔다.
 */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.request<ApiEnvelope<T>>(config);
    const envelope = response.data;

    if (!envelope.success) {
      // 2xx 인데 success:false — 서버가 상태 코드를 잘못 냈거나 프록시가 손댄 경우다.
      throw toApiError(envelope, response.status);
    }
    return envelope.data as T;
  } catch (error) {
    throw normalize(error);
  }
}

export function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ ...config, url, method: 'GET' });
}

export function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ ...config, url, method: 'POST', data: body });
}

function normalize(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const envelope = error.response?.data as ApiEnvelope<unknown> | undefined;
    if (envelope && typeof envelope.success === 'boolean') {
      return toApiError(envelope, error.response?.status ?? 0);
    }
    // 봉투가 아니다 — 네트워크 단절, 프록시 오류, 로그인 HTML 이 온 경우.
    return new ApiError({
      code: TRANSPORT_ERROR_CODE,
      message: staticText('net.unreachable'),
      status: error.response?.status ?? 0,
      // 봉투가 없어도 헤더에는 있다 — 필터가 되돌려주므로(RequestIdMdcFilter) 5xx 도 추적된다.
      traceId: headerTraceId(error),
    });
  }

  return new ApiError({
    code: TRANSPORT_ERROR_CODE,
    message: error instanceof Error ? error.message : staticText('net.unknown'),
    status: 0,
  });
}

function toApiError(envelope: ApiEnvelope<unknown>, status: number): ApiError {
  return new ApiError({
    code: envelope.code ?? TRANSPORT_ERROR_CODE,
    // 문구는 서버가 완성한다. 프론트에 에러 메시지 카탈로그를 두지 않는다(backend/packages.md).
    message: envelope.message ?? staticText('net.failed'),
    status,
    traceId: envelope.traceId,
    fields: envelope.fields,
    rows: envelope.rows,
  });
}

function headerTraceId(error: AxiosError): string | undefined {
  const headers = error.response?.headers as Record<string, unknown> | undefined;
  const value = headers?.['x-request-id'];
  return typeof value === 'string' ? value : undefined;
}
