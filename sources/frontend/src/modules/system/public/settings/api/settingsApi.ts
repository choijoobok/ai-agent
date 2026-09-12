// @feat FEAT-506
import { post } from '@/shared/api';
import { SETTINGS_ENDPOINTS } from '@/modules/system/public/settings/api/endpoints';

/**
 * 언어를 서버에 저장한다 — 의 ②.
 *
 * <p><b>실패하면 던진다.</b> 부르는 쪽이 그때 `localStorage` 를 건드리지 않고 멈춘다 —
 * 둘이 갈리면 다음 접속의 1순위(`localStorage`)와 정본(`LOCALE_CD`)이 어긋나고, 그 어긋남은
 * <b>로그인할 때마다 언어가 바뀌는</b> 것으로 나타난다.
 */
export function saveLocale(localeCd: string): Promise<void> {
  return post<void>(SETTINGS_ENDPOINTS.saveLocale, { localeCd });
}
