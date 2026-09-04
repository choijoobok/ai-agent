import axios, { AxiosError, type AxiosResponse } from 'axios';
import { newRequestId } from '@/shared/api/requestId';
import { emitResponseSignal } from '@/shared/api/responseSignals';
import type { ApiEnvelope } from '@/shared/api/types';
import { resolveLang } from '@/shared/i18n/lang';

/**
 * 공용 axios 인스턴스 — 규약은 frontend-stack.md §9.
 *
 * <p>응답 쪽은 <b>관찰만</b> 한다 — 세션 차원의 신호(권한 버전 · 401)를 흘려보내고 흐름은
 * 건드리지 않는다. 무엇을 띄울지는 셸이 정한다(frontend-stack.md §9 · ADR-0021).
 */
export const apiClient = axios.create({
  baseURL: '/api',
  // 세션 쿠키 인증. 동일 오리진이지만 명시한다 — 프록시 경유 개발에서도 같게 동작한다.
  withCredentials: true,
});

/** 활성 탭의 메뉴 코드. 셸이 라우트 전환마다 갱신한다(frontend-stack.md §9). */
let activeMenuCode: string | null = null;

export function setActiveMenuCode(menuCd: string | null): void {
  activeMenuCode = menuCd;
}

apiClient.interceptors.request.use((config) => {
  // 헤더와 쿼리 양쪽에 싣는다 — 이중 채널이 규약이다(29).
  const rid = newRequestId();
  config.headers.set('X-Request-Id', rid);
  config.params = { ...(config.params as object | undefined), _rid: rid };

  // 메뉴 문맥이 없는 호출(로그인·하트비트)은 생략한다. 빈 문자열이 아니라 아예 안 보낸다.
  if (activeMenuCode) {
    config.headers.set('X-Menu-Code', activeMenuCode);
  }

  // 언어를 정한 쪽이 그것을 말한다 — architecture.md §6-1.2 · 50 §3.2.
  //
  // 서버는 세션이 없는 요청의 에러 문구를 "요청의 언어 힌트" 로 만든다. 브라우저가 보내는
  // Accept-Language 를 그대로 두면 그 힌트가 **프론트가 정한 언어와 다르다** — 화면은
  // 영어인데 로그인 실패 문구만 한국어로 나온다(2026-08-29 실측). 순위 1(localStorage 의
  // 직전 언어)을 서버가 볼 방법이 없기 때문이며, 그래서 결정을 헤더로 넘긴다.
  //
  // 로그인 뒤에는 LOCALE_CD 가 이긴다(RequestLocale). 이 헤더가 실제로 쓰이는 구간은
  // 로그인 전이고, 거기서는 이 값이 유일한 원본이다.
  config.headers.set('Accept-Language', resolveLang());

  return config;
});

/**
 * 성공이든 실패든 <b>같은 신호</b>를 낸다 — 403 응답에도 권한 버전이 실리기 때문이다.
 * 성공만 보면 <i>"권한이 줄어서 거부된"</i> 바로 그 응답을 놓친다.
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    emitResponseSignal({ status: response.status, authzVersion: authzVersionOf(response) });
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const envelope = error.response.data as ApiEnvelope<unknown> | undefined;
      emitResponseSignal({
        status: error.response.status,
        authzVersion: authzVersionOf(error.response),
        code: envelope?.code,
        message: envelope?.message,
      });
    }
    // 신호를 냈을 뿐 처리하지 않는다. 호출부가 평소대로 실패를 받는다.
    return Promise.reject(error);
  },
);

function authzVersionOf(response: AxiosResponse): string | null {
  const value = response.headers['x-authz-version'] as unknown;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
