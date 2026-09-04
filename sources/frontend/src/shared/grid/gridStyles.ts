/**
 * 셀·행의 색 — frontend/grid.md. <b>그리드가 스스로 색을 정하지 않는다.</b>
 *
 * <p>값은 전부 CSS 변수이고 채우는 것은 {@code DataGrid} 가 antd 토큰에서 한다 — 사용자가
 * 모드·톤을 바꾸면 셸과 함께 따라온다. 여기 hex 가 하나라도 있으면 <b>화면의 절반만</b>
 * 따라오게 된다(frontend/grid.md).
 *
 * <p><b>우선순위를 소스 순서로 표현한다</b>(frontend/grid.md). 아래로 갈수록 이긴다 —
 * 컬럼 상태(6) → 행 상태(5) → 선택 행(4) → 검증 실패(1). 편집 중인 셀(2)과 선택 셀(3)은
 * AG Grid 테마가 그린다.
 *
 * <p><b>스타일시트가 이 프로젝트의 유일한 CSS 다.</b> antd 6 은 CSS-in-JS 라 파일이 없고,
 * AG Grid 는 클래스로 칠해야 한다 — 인라인 {@code cellStyle} 로 하면 <b>선택 배경을
 * 이겨 버려</b> 위 순서가 뒤집힌다.
 */
const STYLE_ID = 'bo-grid-style';

/*
  `bo-header-required` — 필수 컬럼의 헤더에 붙는 `*` 다(frontend/grid.md).

  <b>글자가 아니라 CSS 다.</b> 헤더 문자열에 붙이면 그 문자열이 정렬·필터·엑셀로 함께
  흘러 `그룹 코드 *` 가 파일의 헤더가 된다 — 붙는 자리는 화면 하나뿐이다.

  색은 검증 실패의 테두리와 <b>같은 변수</b>를 쓴다. 별표와 붉은 셀은 같은 것을 말하므로
  (이 칸을 채워야 한다) 색이 갈리면 둘이 다른 일로 읽힌다.

  `bo-cell-removed` — 취소선이 <b>한 셀에만</b> 걸리는 경우다(screen/code/requirements.md 의 되돌리기).

  거기서는 행이 사라지지 않는다. 지우는 것은 오버라이드 한 줄이고 목록의 행은 남으므로,
  전 셀에 취소선을 그으면 *"이 행이 통째로 없어진다"* 로 읽힌다. 무엇이 사라지는지를
  <b>사라지는 그 칸</b>이 말한다.

  설명이 CSS 문자열 밖에 있는 것은 그 안의 한글을 ESLint 가 <b>번역 안 한 문구</b>로 보기
  때문이다 — 규칙이 옳다: 저 문자열은 화면에 나가는 것과 같은 모양이라 가릴 수 없다.

  `bo-detail-tabs` — <b>탭 안의 그리드가 남는 높이를 쓰게 한다</b>(screen/user/requirements.md 이 처음 요구했다).

  탭 다섯이 다 그리드인 화면이 생기면서 필요해졌다. 그리드는 <i>자기 몫을 채우는</i>
  컴포넌트인데 antd 의 탭 본문 래퍼 셋(`content-holder` · `content` · `tabpane`)이 기본
  높이가 auto 라, 그 사이에서 높이가 <b>끊긴다</b> — 헤더와 푸터만 보이고 판이 0px 이 된다
  (2026-08-31 실물).

  <b>활성 것만 편다</b>(`content-active`). 전부에 `display: flex` 를 주면 antd 가 비활성
  본문을 감추는 방식과 부딪친다. 래퍼의 이름은 antd 판마다 갈리므로(여기는
  `body-holder` → `body` → `content`) <b>실물에서 확인한 사슬</b>을 적는다.

  탭바의 <b>높이와 탭 최소 폭</b>도 여기 있다(2026-08-31). 값은 CSS 변수로 오며 채우는 것은
  `DetailTabs` 다 — antd 토큰은 컴포넌트 안에서만 얻을 수 있고 이 스타일시트는 정적
  문자열이다. 변수에 기본값을 함께 적어 두는 것은 <b>클래스만 손으로 붙인 탭</b>이 눌린
  탭바로 뜨지 않게 하려는 것이다.

  `min-width` 를 탭 <b>자체</b>에 건다. 안쪽 글자에 걸면 antd 가 그리는 좌우 여백이 그
  위에 더해져 <b>선언한 값보다 넓어진다</b>. 가운데 정렬을 함께 거는 것은, 폭을 늘리면
  짧은 이름이 왼쪽에 몰려 <b>탭 사이 간격이 제각각으로</b> 보이기 때문이다.

  `bo-detail-tabs-collapsed` — <b>접히면 탭바가 사라진다</b>(2026-08-31 실물).

  그리드 하나만 있는 하단은 접히면 제목 한 줄이 남는데(frontend/grid.md), 탭이 있는 하단은
  <b>탭바 · 버튼 줄 · 페이징이 그대로 남고 판만 0px</b> 이 됐다 — 접은 것이 아니라
  <i>판이 깨진 것</i>으로 보였다. 탭바만 감추면 남은 본문의 그리드가 스스로 제목 한 줄로
  접히므로 결과가 <b>그리드 하나짜리 하단과 같은 모양</b>이 된다.

  `display: none` 이다. 높이 0 으로 두면 antd 의 잉크 바(활성 탭 밑줄)가 <b>1px 짜리
  선으로</b> 남고, 그 선이 접힌 제목 줄 위에 떠서 어디에 속한 선인지 읽히지 않는다.
*/

const CSS = `
.bo-grid .bo-header-required .ag-header-cell-text::after {
  content: '*';
  margin-inline-start: 2px;
  color: var(--bo-grid-invalid-border);
}

.bo-grid .bo-cell-readonly { background-color: var(--bo-grid-readonly); }
.bo-grid .bo-cell-required { background-color: var(--bo-grid-required); }

.bo-grid .ag-row.bo-row-added,
.bo-grid .ag-row.bo-row-updated { background-color: var(--bo-grid-changed); }
.bo-grid .ag-row.bo-row-removed .ag-cell { text-decoration: line-through; opacity: 0.55; }
.bo-grid .ag-cell.bo-cell-removed { text-decoration: line-through; opacity: 0.55; }

.bo-grid .ag-row.ag-row-selected { background-color: var(--bo-grid-selected); }

.bo-grid .bo-cell-invalid {
  background-color: var(--bo-grid-invalid) !important;
  box-shadow: inset 0 0 0 1px var(--bo-grid-invalid-border);
}

.bo-detail-tabs { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.bo-detail-tabs > .ant-tabs-nav { min-height: var(--bo-tab-bar-height, 48px); margin-bottom: 4px; }
.bo-detail-tabs > .ant-tabs-nav .ant-tabs-tab {
  min-width: var(--bo-tab-min-width, 100px);
  justify-content: center;
}
.bo-detail-tabs-collapsed > .ant-tabs-nav { display: none; }
.bo-detail-tabs > .ant-tabs-body-holder { display: flex; flex: 1; min-height: 0; }
.bo-detail-tabs .ant-tabs-body { display: flex; flex: 1; min-height: 0; }
.bo-detail-tabs .ant-tabs-content-active { display: flex; flex-direction: column; flex: 1; min-height: 0; }
`;

/**
 * 한 번만 넣는다. 컴포넌트마다 넣으면 같은 규칙이 여러 벌 쌓이고, 그 순서가 곧 우선순위라
 * <b>마지막에 들어간 벌이 이긴다</b> — 규칙은 같지만 진단이 불가능해진다.
 */
export function ensureGridStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const element = document.createElement('style');
  element.id = STYLE_ID;
  element.textContent = CSS;
  document.head.appendChild(element);
}
