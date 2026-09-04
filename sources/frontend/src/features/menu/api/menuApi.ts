import { post } from '@/shared/api';
import { MENU_ENDPOINTS } from '@/features/menu/api/endpoints';
import type { PageResponse } from '@/shared/grid/types';
import type { MenuSiblingGroup, MenuTreeRow } from '@/features/menu/types';

/**
 * 메뉴 트리 — screen/menu/requirements.md.
 *
 * <p><b>이 화면은 그리드 선언을 쓰지 않는다</b>({@code TreeGrid} 다 — frontend/packages.md). 그래서
 * 조회·저장·삭제가 전부 여기 있다.
 */
export function getMenuTree(): Promise<PageResponse<MenuTreeRow>> {
  return post<PageResponse<MenuTreeRow>>(MENU_ENDPOINTS.getTree);
}

/** 속성 저장 — 셀 하나를 고치면 그 행의 넷을 함께 보낸다(screen/menu/requirements.md). */
export function saveMenu(
  menuCd: string,
  menuUrl: string | null,
  iconCd: string | null,
  useYn: boolean,
): Promise<void> {
  return post<void>(MENU_ENDPOINTS.save, { menuCd, menuUrl, iconCd, useYn });
}

/**
 * 순서 저장 — <b>형제 묶음 단위로 전체를 다시 쓴다</b>(sys/menu.md).
 *
 * <p>옮긴 노드 하나만 보내면 뺀 쪽의 번호에 구멍이 남고(`1,2,4`), *언제나 정규화 상태* 라는
 * 전제가 깨진다.
 */
export function saveTree(groups: MenuSiblingGroup[]): Promise<void> {
  return post<void>(MENU_ENDPOINTS.saveTree, { groups });
}

/** 노드 추가 — 최상위면 {@code upMenuCd} 가 {@code null} 이다. */
export function saveNode(upMenuCd: string | null, menuCd: string): Promise<void> {
  return post<void>(MENU_ENDPOINTS.saveNode, { upMenuCd, menuCd });
}

/** 삭제 — 게이트 넷이 전부 `0` 일 때만 부를 수 있다(screen/menu/requirements.md). 즐겨찾기는 함께 지워진다. */
export function deleteNode(menuCd: string): Promise<void> {
  return post<void>(MENU_ENDPOINTS.deleteNode, { menuCd });
}
