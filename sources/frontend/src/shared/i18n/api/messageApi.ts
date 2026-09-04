import { get } from '@/shared/api';
import { MESSAGE_ENDPOINTS } from '@/shared/i18n/api/endpoints';

/** 서버 `MessageBundleResponse` 와 1:1. `unchanged` 면 `messages` 가 없다. */
export interface MessageBundle {
  lang: string;
  /**
   * 지원 언어 전부 — **`unchanged` 여도 온다**.
   *
   * <p>sys/code.md 은 이 목록의 원본을 공통코드(`LANG_CD`)로 정했고 screen/code/requirements.md 는 다국어 관리 화면의
   * 하단 행 수가 *"이미 캐시에 있는"* 그 목록에서 온다고 했다. `SYS_CODE` 가 없는 동안
   * **이 번들이 그 캐시 자리를 대신한다** — 별도 API 를 두면 화면 진입마다 왕복이 하나 늘고,
   * 그 API 는 공통코드가 생기는 날 지울 것이 된다.
   */
  langs: string[];
  version: number;
  unchanged: boolean;
  messages?: Record<string, string>;
}

/**
 * @param version 들고 있는 번들의 버전. 넘기면 같을 때 **본문 없이** 돌아온다(sys/code.md) —
 *   두 번째 이후 접속이 이 경로이며, 그래서 실제로 전량을 받는 것은 첫 접속뿐이다.
 */
export function fetchMessageBundle(lang: string, version?: number): Promise<MessageBundle> {
  const query = new URLSearchParams({ lang });
  if (version !== undefined) query.set('v', String(version));
  return get<MessageBundle>(`${MESSAGE_ENDPOINTS.getBundle}?${query.toString()}`);
}
