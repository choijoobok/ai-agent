import { get, post } from '@/shared/api';
import { FAVORITE_ENDPOINTS } from '@/shared/favorite/api/endpoints';

/** 서버가 내는 한 줄 — <b>이름이 없다</b>. 이름의 단일 원본은 메뉴 트리다(sys/code.md). */
export interface FavoriteMenu {
  menuCd: string;
  sortNo: number;
  creDtm: string;
}

/**
 * 즐겨찾기 — UX-03 · sys/menu.md.
 *
 * <p><b>셋 다 목록 전체를 돌려받는다.</b> 다른 브라우저 탭이 넣은 것처럼 <i>요청에 없던
 * 변화</i>가 있을 수 있고, 화면이 그것을 스스로 계산하면 서버와 어긋난다.
 */
export function getFavorites(): Promise<FavoriteMenu[]> {
  return get<FavoriteMenu[]>(FAVORITE_ENDPOINTS.getList);
}

export function addFavorite(menuCd: string): Promise<FavoriteMenu[]> {
  return post<FavoriteMenu[]>(FAVORITE_ENDPOINTS.save, { menuCd });
}

export function removeFavorite(menuCd: string): Promise<FavoriteMenu[]> {
  return post<FavoriteMenu[]>(FAVORITE_ENDPOINTS.delete, { menuCd });
}
