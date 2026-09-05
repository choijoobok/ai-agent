import { post } from '@/shared/api';
import { CONFIG_ENDPOINTS } from '@/features/config/api/endpoints';

/**
 * 시스템 환경설정 — screen/config/requirements.md.
 *
 * <p><b>접두사는 목록 응답에 실리지 않는다</b>(screen/config/requirements.md) — 전 키에서 도출된 고정 집합이라
 * 지금 걸린 조건의 결과로 내면 <b>한 번 좁힌 뒤 넓힐 수 없는 콤보</b>가 된다.
 */
export function getConfigPrefixes(): Promise<string[]> {
  return post<string[]>(CONFIG_ENDPOINTS.getPrefixes);
}
