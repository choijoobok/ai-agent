import type { MenuIndex, MenuNode } from '@/shared/authz/menuTree';

/**
 * 메뉴 검색 — main-shell.md §4.2. <b>클라이언트 필터이며 서버 왕복이 없다.</b>
 *
 * <p>프론트가 로그인 시 이미 유효 권한 메뉴 트리를 갖고 있고(AUTHZ-04) 번역도 프론트가
 * 한다. 서버로 보내면 서버가 사용자 언어로 번역해야 하고 <b>언어별 인덱스</b>가 따라온다 —
 * 타이핑마다 반응해야 하는 요구와도 맞지 않는다.
 *
 * <p>따라서 <b>매칭 대상은 그 사용자가 열 수 있는 메뉴로 이미 좁혀져 있다</b> — 권한 필터를
 * 여기서 따로 걸지 않는다(main-shell.md §4.4).
 */

export interface MenuSearchHit {
  node: MenuNode;
  /** 자신을 포함한 루트→자신 경로. <b>트리 역산이 이미 만든 것</b>을 그대로 쓴다. */
  path: MenuNode[];
}

/**
 * <b>공백 제거 + 소문자화</b>를 양쪽에 건다.
 *
 * <p>대소문자를 구분하면 `en` 배포에서 검색이 사실상 동작하지 않는다. 공백을 지우는 것은
 * <i>"사용자 관리"</i> 와 <i>"사용자관리"</i> 를 같게 보기 위해서다.
 */
export function normalizeForSearch(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/**
 * @param translate 메시지 키 → 현재 언어의 문자열. <b>번역된 이름</b>으로 비교하는 것이
 *     이 함수의 전제이며, 키(`menu.USER_MGMT`)로 비교하면 사용자가 보는 것과 다른 것을 찾는다
 */
export function searchMenus(
  index: MenuIndex,
  query: string,
  translate: (messageKey: string) => string,
): MenuSearchHit[] {
  const needle = normalizeForSearch(query);
  // 정규화 후 빈 문자열이면 검색을 실행하지 않는다 — 공백만 친 것은 묻지 않은 것이다.
  if (needle === '') {
    return [];
  }

  return (
    index.leaves
      // 경로는 매칭에 참여하지 않는다 — 표시용이다(main-shell.md §4.2). 넣으면 `기준정보` 하나로
      // 그 폴더의 하위 전체가 걸려 결과가 폭발한다.
      .filter((node) => normalizeForSearch(translate(node.menuNm)).includes(needle))
      // 정렬은 트리 순서다. `leaves` 가 이미 그 순서로 쌓여 있다 — *"일치 위치가 앞선 것
      // 우선"* 이 UX 로는 나을 수 있으나 결과 순서를 예측할 수 없게 된다.
      .map((node) => ({ node, path: index.pathByCode.get(node.menuCd) ?? [node] }))
  );
}

/**
 * 이미 뽑아 둔 목록을 <b>그 안에서만</b> 좁힌다 — main-shell.md §4.3 의 <i>"탭 내 검색 필드"</i>.
 *
 * <p><b>{@link searchMenus} 와 다른 것이다.</b> 저쪽은 전체 메뉴에서 찾고 이쪽은 지금 탭의
 * 목록만 거른다. 빈 질의의 뜻도 반대다 — 전체 검색에서 빈 질의는 <b>묻지 않은 것</b>이라
 * 아무것도 내지 않지만, 필터에서 빈 질의는 <b>거르지 않는 것</b>이라 전부 남는다.
 */
export function filterHits(
  hits: MenuSearchHit[],
  query: string,
  translate: (key: string) => string,
): MenuSearchHit[] {
  const needle = normalizeForSearch(query);
  if (needle === '') {
    return hits;
  }
  return hits.filter((hit) => normalizeForSearch(translate(hit.node.menuNm)).includes(needle));
}
