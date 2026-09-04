import type { GlobalToken } from 'antd';

/**
 * 트리 그리드의 <b>판 색과 여백</b> — screen/menu/requirements.md · frontend/grid.md.
 *
 * <p>트리는 AG Grid 를 쓰지 않고 직접 그린다(Tree Data 가 Enterprise 다 — frontend/grid.md). 그래서
 * <b>판이 테마에서 계산해 주던 값을 여기서 손으로 계산한다</b>. 값을 눈대중으로 고르지 않고
 * <b>판의 테마 파라미터와 1:1 로 맞추는</b> 것이 이 파일의 전부다(2026-08-31 요청:
 * <i>"헤더와 셀 등 디자인이 AG Grid 와 너무 이질적"</i>).
 *
 * <table>
 *   <tr><th>여기</th><th>판의 파라미터</th><th>판의 기본값</th></tr>
 *   <tr><td>{@link TreeSkin.border}</td><td>{@code borderColor}</td>
 *       <td>글자색 15% — antd 의 {@code colorBorder} 가 같은 자리다</td></tr>
 *   <tr><td>{@link TreeSkin.headerBackground}</td><td>{@code headerBackgroundColor}</td>
 *       <td>{@code chromeBackgroundColor} = 글자색 2% 를 면 위에</td></tr>
 *   <tr><td>{@link TreeSkin.headerFontWeight}</td><td>{@code headerFontWeight}</td><td>500</td></tr>
 *   <tr><td>{@link TreeSkin.cellPaddingInline}</td><td>{@code cellHorizontalPadding}</td>
 *       <td>{@code spacing * 2} = 16px</td></tr>
 *   <tr><td>{@link TreeSkin.rowHover}</td><td>{@code rowHoverColor}</td>
 *       <td>강조색 8% (다크 15%)</td></tr>
 *   <tr><td>{@link TreeSkin.rowSelected}</td><td>{@code selectedRowBackgroundColor}</td>
 *       <td>강조색 12% — 다만 우리 판은 이것을 {@code --bo-grid-selected} 로 덮는다</td></tr>
 *   <tr><td>{@link TreeSkin.readonlyCell}</td><td>—</td>
 * <td>판이 아니라 <b>우리 규약</b>이다 — {@code.bo-cell-readonly}(frontend/grid.md)</td></tr>
 * </table>
 *
 * <p><b>토큰에서 받는 것이 요점이다</b>({@code thinScrollbar} 와 같은 규약). 값을 박으면
 * 사용자가 톤·모드를 바꿀 때 <b>트리만 따라오지 않는다</b> — frontend/tabs.md 이 <i>"화면의 절반만
 * 따라온다"</i> 로 적은 그것이다.
 */
export interface TreeSkin {
  /** 머리 아래 · 행 사이 · 판 둘레의 1px. */
  border: string;
  /** 머리 줄의 바닥 — <b>불투명해야 한다</b>(아래 주석). */
  headerBackground: string;
  headerFontWeight: number;
  /** 셀의 좌우 여백. 계층 컬럼의 <b>들여쓰기 기준</b>도 이 값이다. */
  cellPaddingInline: number;
  rowHover: string;
  rowSelected: string;
  /**
   * <b>편집할 수 없는 셀</b>의 색 — `.bo-cell-readonly` 와 같은 값이다.
   *
   * <p>이 프로젝트의 그리드는 <b>열리는 칸을 표시하지 않고 잠긴 칸을 칠한다</b>(frontend/grid.md ·
   * `columnRules.editableOf`). 트리도 같은 규칙을 써야 <i>어디를 더블 클릭할 수 있나</i> 를
   * 두 판에서 같은 방법으로 읽는다 — 트리만 규칙이 다르면 그 화면에서 배운 것이 옆 화면에서
   * 틀린다.
   */
  readonlyCell: string;
}

/**
 * 판의 {@code cellHorizontalPadding} — {@code spacing * 2} 다.
 *
 * <p><b>상수로 따로 낸다.</b> 계층 컬럼의 <b>들여쓰기 기준</b>이자 폭 계산의 입력이라
 * ({@code indentOf} · {@code HIERARCHY_CHROME}) 렌더 밖의 순수 함수들이 이 값을 봐야 하고,
 * 토큰과 무관한 <b>고정값</b>이라 그럴 수 있다 — 판도 이 값을 색이 아니라 간격으로 둔다.
 */
export const CELL_PADDING = 16;

/**
 * 판의 {@code rowHoverColor} · {@code selectedRowBackgroundColor} 가 <b>알파 혼합</b>이라
 * 그대로 옮긴다 — {@code color-mix} 다.
 *
 * <p><b>판이 이미 그것을 쓴다.</b> AG Grid 의 테마 CSS 자체가 {@code color-mix(in srgb, …)}
 * 로 색을 섞으므로, 이 프로젝트가 도는 브라우저는 이미 그 함수를 지원한다 — 우리가 새로
 * 요구하는 것이 아니다.
 */
function mix(over: string, percent: number, onto: string): string {
  return `color-mix(in srgb, ${over} ${String(percent)}%, ${onto})`;
}

export function treeSkin(token: GlobalToken, dark: boolean): TreeSkin {
  return {
    border: token.colorBorder,
    /*
      <b>불투명해야 한다.</b> {@code colorFillAlter} 는 글자색의 <b>알파 2%</b>(다크는 4%)라
      붙박이 머리 <b>아래로 지나가는 행이 그대로 비쳐</b> 글자가 겹쳐 보였다(2026-08-31 실물).

      색조는 그대로 두고 <b>바닥만 깐다</b> — 층을 둘로 준다: 위가 옅은 채운색, 아래가 판의
      면이다. 면 하나로 바꾸면 머리와 본문이 <b>같은 색</b>이 되어 머리인 줄 알 수 없다.
    */
    headerBackground:
      `linear-gradient(${token.colorFillAlter}, ${token.colorFillAlter}), `
      + `${token.colorBgContainer}`,
    headerFontWeight: 500,
    cellPaddingInline: CELL_PADDING,
    // 다크에서 8% 는 보이지 않는다 — 판도 그쪽에서 15% 로 올린다(`colorSchemeDark`).
    rowHover: mix(token.colorPrimary, dark ? 15 : 8, token.colorBgContainer),
    // `--bo-grid-selected` 와 <b>같은 토큰</b>이다 — 두 판의 선택이 같은 색이어야 한다.
    rowSelected: token.colorPrimaryBg,
    readonlyCell: token.colorFillQuaternary,
  };
}
