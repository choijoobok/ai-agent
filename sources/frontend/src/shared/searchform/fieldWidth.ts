/**
 * 조회조건 한 칸의 폭 — search-form-contract.md §3.10. <b>값 칸과 연산자 칸이 따로다.</b>
 *
 * <p><b>파일이 따로인 이유는 Fast Refresh 다.</b> 이 값을 {@code SearchForm.tsx} 가 갖고 있으면
 * 그것을 읽는 쪽이 컴포넌트 파일을 가져오게 되고, 컴포넌트와 그 밖의 것을 함께 내보내는
 * 파일은 편집할 때마다 모듈 전체가 다시 평가되어 <b>상태가 날아간다</b>
 * (`react-refresh/only-export-components` — `BreadcrumbSlot` 이 훅과 파일을 가른 것과 같다).
 *
 * <p><b>읽는 쪽이 둘이 됐다</b>(2026-08-31 — 62 §4.10). 트리의 ①에 선 검색 칸이 <i>조회조건과
 * 같은 크기</i> 여야 하는데, 숫자를 그쪽에 다시 적으면 <b>한쪽만 고치는 실수</b>가 난다 —
 * 같은 일을 하는 칸이 화면 안에서 두 크기인 것이 곧 학습 비용이다.
 */

/** 연산자 칸을 <b>뺀</b> 값 칸의 폭이다. */
export const SEARCH_VALUE_WIDTH = 300;

/** 연산자 버튼 — 기호 하나가 들어간다(search-form-contract.md §3.4). */
export const SEARCH_OP_WIDTH = 44;
