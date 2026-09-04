/**
 * 메뉴 트리 API — 62 §4.12.
 *
 * <p>호출 URL 은 이 파일에만 둔다(frontend-stack.md §9). <b>이 선언이 `SYS_MENU_API` 시드의 입력</b>이므로
 * (ADR-0020) *선언 = 사용* 이 구조적으로 보장돼야 한다 — `generateApiSeed` 가
 * `screenRegistry` 의 `/menu` → `@/features/menu` 를 따라와 여기를 읽는다.
 *
 * <p><b>여덟인 것이 이 화면의 모양이다.</b> 조회 하나 · 쓰기 넷 · 탭 셋.
 *
 * <p><b>쓰기가 넷인 것이 즉시 저장의 값이다</b>(62 §4.4). 위치 변경은 즉시일 수밖에 없고
 * (형제 전체 재작성 + `@CustomLock(WAIT)` — 42 §4) 한 그리드 안에서 일괄과 즉시를 섞지
 * 않으므로 전부 즉시가 됐다. 저장 버튼이 없는 대신 경로가 연산마다 하나다.
 *
 * <p><b>`exportExcel` 이 없다.</b> 엑셀은 있지만(52 §4.2 의 액션 열이 `R S E` 다) 그것은
 * **프론트 생성**이다(grid-standard.md §2.2 · ADR-0019 첫째 · 62 §4.9) — 서버가 낼 것이 없다.
 */
export const MENU_ENDPOINTS = {
  getTree: '/service/menu/getTree',
  /** 신규 노드 — 모달이 받는 칸은 `MENU_CD` 하나다(62 §4.6). */
  saveNode: '/service/menu/saveNode',
  /** 속성 — **셀 하나에 요청 하나**다(62 §4.4). */
  save: '/service/menu/save',
  /** 위치 — 드래그 결과의 **형제 목록**이다(42 §4). */
  saveTree: '/service/menu/saveTree',
  deleteNode: '/service/menu/deleteNode',
  getApiList: '/service/menu/getApiList',
  getAccessibleUsers: '/service/menu/getAccessibleUsers',
  getRoleList: '/service/menu/getRoleList',
} as const;
