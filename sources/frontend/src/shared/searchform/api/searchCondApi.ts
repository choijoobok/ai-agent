import { get, post } from '@/shared/api';
import { SEARCH_COND_ENDPOINTS } from '@/shared/searchform/api/endpoints';
import type { SavedCond } from '@/shared/searchform/savedCond';

/**
 * 저장된 조회조건 — UX-07 · search-form-contract.md §5.
 *
 * <p><b>셋 다 목록 전체를 돌려받는다.</b> 저장이 남기는 변화가 요청에 없기 때문이다 —
 * 이전 기본 조건이 내려오는 것(§5.4)은 서버가 하는 일이고, 화면이 그것을 스스로 계산하면
 * 서버와 어긋난다.
 */
export function getSavedConds(menuCd: string): Promise<SavedCond[]> {
  return get<SavedCond[]>(SEARCH_COND_ENDPOINTS.getList, { params: { menuCd } });
}

export function saveSavedCond(
  menuCd: string,
  condNm: string,
  condJson: string,
  dflt: boolean,
): Promise<SavedCond[]> {
  return post<SavedCond[]>(SEARCH_COND_ENDPOINTS.save, { menuCd, condNm, condJson, dflt });
}

export function deleteSavedCond(menuCd: string, condNm: string): Promise<SavedCond[]> {
  return post<SavedCond[]>(SEARCH_COND_ENDPOINTS.delete, { menuCd, condNm });
}
