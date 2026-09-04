/**
 * 헤더 글자가 <b>잘리지 않을 최소 폭</b> — frontend/grid.md 의 {@code width} 는 그 아래로 내려가지 않는다.
 *
 * <h2>왜 선언한 폭만으로는 모자라나</h2>
 *
 * <p>선언의 폭은 <b>값</b>을 기준으로 고른 숫자다({@code 90} 짜리 {@code ynFlag} 칸). 그런데
 * 헤더는 다국어이고 <b>한글은 라틴 글자보다 넓다</b> — 같은 컬럼이 영어에서는 남고 한글에서는
 * 말줄임표가 된다(2026-08-31 실물). 화면마다 숫자를 키우는 것은 <b>언어가 늘 때마다 전 화면을
 * 다시 재는 일</b>이라, 잘리지 않는 폭을 <b>어댑터가 계산한다</b>.
 *
 * <h2>판의 자동 맞춤을 쓰지 않는다</h2>
 *
 * <p>{@code autoSizeColumns} 는 <b>값까지</b> 재서 폭을 정하므로 긴 값 하나가 컬럼을 화면
 * 밖으로 밀고, 사용자가 끌어 놓은 폭(frontend/grid.md)과 <b>매 조회마다 다툰다</b>. {@code wrapHeaderText}
 * 는 헤더를 두 줄로 만드는데 하단 탭처럼 낮은 판에서는 그 한 줄이 본문에서 나온다.
 *
 * <p>그래서 <b>헤더만 재고 폭은 최소값으로만</b> 쓴다 — 선언이 이미 더 넓으면 그대로이고,
 * 사용자가 끌면 그것이 이긴다(그 층은 {@code DataGrid} 가 갖는다).
 *
 * <h2>재는 방법</h2>
 *
 * <p>캔버스로 <b>실제 글자 폭</b>을 잰다. 글자 수 × 상수로 어림하면 한글·라틴·숫자가 섞인
 * 헤더에서 어긋나고({@code API URL} 과 {@code 사용 여부} 는 글자 수가 같다), 글꼴·크기가
 * 사용자 설정이라(frontend/tabs.md) 상수를 고를 수도 없다.
 *
 * <p><b>DOM 을 만들지 않는다.</b> 컬럼마다 요소를 붙였다 재고 지우면 선언이 다시 계산될
 * 때마다 레이아웃이 그만큼 돈다 — 캔버스의 {@code measureText} 는 레이아웃을 건드리지 않으며,
 * 같은 글꼴·글자는 <b>한 번만</b> 잰다.
 */

/** 글꼴별 측정 캐시 — 키가 `{font}\n{text}` 다. */
const measured = new Map<string, number>();

let context: CanvasRenderingContext2D | null = null;
/**
 * 캔버스를 <b>한 번만 물어본다</b> — 실패도 기억한다.
 *
 * <p>{@code context} 가 {@code null} 인 것으로는 <i>아직 안 물어봤다</i> 와 <i>물어봤는데
 * 없다</i> 가 갈리지 않아, jsdom 에서 컬럼마다 다시 묻고 그때마다 경고가 한 줄씩 쌓였다.
 */
let probed = false;

/**
 * 헤더 셀이 글자 말고 쓰는 폭 — <b>판의 테마 값에서 옮겨 적는다</b>.
 *
 * <p><b>어림하지 않는다</b>(2026-08-31 — 한 번 어림했다가 아무것도 안 고쳐졌다). 처음에는
 * {@code 26 + 20} 으로 두었는데, 계산한 최소 폭이 선언한 폭보다 작아 <b>넓혀지는 컬럼이
 * 하나도 없었다</b> — 화면은 고치기 전과 똑같았다.
 *
 * <p><b>그러고도 두 번 틀렸다</b>(2026-09-01 · 옆 세션이 짚었다).
 *
 * <ul>
 *   <li>여백을 {@code spacing * 3} = 24(양쪽 48)로 읽었는데 그것은 <b>Material 의
 *       덮어쓰기</b>였다({@code themeMaterialParams}). 우리는 {@code themeQuartz} 이므로
 *       기본값 {@code spacing * 2 * cellHorizontalPaddingScale} = <b>16</b>(양쪽 32)이다 —
 *       판의 JS 폴백도 {@code cssVariable("cellHorizontalPadding", "length", 16)} 이다
 *   <li><b>필터 버튼을 빠뜨렸다.</b> 아이콘이 <i>필터가 걸릴 때만</i> 붙는 줄 알았는데,
 *       판은 <b>필터를 걸 수 있는 컬럼이면 언제나</b> 버튼을 그린다
 *       ({@code !suppressHeaderFilterButton && isFilterAllowed(column)}) — 우리는 컬럼
 *       메뉴만 껐고({@code suppressHeaderMenuButton}) 이 버튼은 켜져 있다. 게다가 메뉴
 *       버튼과 달리 {@code opacity: 1} 이라 <b>늘 보인다</b>
 * </ul>
 *
 * <p>둘이 서로를 가려 합계가 우연히 비슷했다 — 여백을 16 더 잡고 필터 버튼 28 을 빠뜨렸다.
 * 그래서 <b>필터 있는 컬럼은 여전히 모자라고</b>(계정 상태: 필요 60, 계산 48) <b>없는 컬럼은
 * 16 낭비</b>였다. 몫을 셋으로 갈라야 둘 다 맞는다.
 *
 * <table>
 *   <tr><td>{@code spacing}</td><td><b>8</b></td><td>아래 둘의 바탕</td></tr>
 *   <tr><td>{@code cellHorizontalPadding}</td><td>{@code spacing * 2} = <b>16</b></td>
 *       <td>헤더 셀의 {@code padding: 0 16px} — <b>양쪽이라 32</b></td></tr>
 *   <tr><td>{@code cellWidgetSpacing}</td><td>{@code spacing * 1.5} = <b>12</b></td>
 *       <td>글자와 아이콘 사이의 {@code gap}</td></tr>
 *   <tr><td>{@code iconSize}</td><td><b>16</b></td><td>정렬 화살표 · 필터 버튼</td></tr>
 * </table>
 *
 * <p><b>{@code themeQuartz} 는 이것들을 덮지 않는다</b>({@code fontFamily} 하나만 바꾼다) —
 * 우리 테마도 그렇다({@code themeTokens}). 하나를 바꾸는 날 <b>이 상수도 함께 바뀐다</b>:
 * 어긋나면 증상이 조용하다(헤더가 다시 잘린다).
 *
 * <p><b>여유 4px 을 둔다.</b> 아이콘 크기가 아이콘 셋마다 16~18 로 갈리고(Material 은 18)
 * 소수점 반올림이 겹치므로, 정확히 맞춰 두면 <b>몇 px 때문에 다시 말줄임표</b>가 된다 —
 * 넉넉한 쪽의 대가는 컬럼 하나가 4px 넓은 것뿐이다.
 */
const CELL_PADDING = 32;
const ICON_WITH_GAP = 28;
const SLACK = 4;

/** 필수 표시(`*`)는 CSS 가 붙이므로 글자 측정에 들어오지 않는다 — frontend/grid.md. */
const REQUIRED_MARK = 10;

/**
 * 이 헤더가 잘리지 않을 폭(px).
 *
 * <p>캔버스를 얻지 못하는 환경(jsdom)에서는 <b>0 을 낸다</b> — 그때는 선언한 폭이 그대로이며
 * 테스트가 측정값에 매이지 않는다.
 */
export function headerMinWidth(
  text: string,
  font: string,
  options: {
    sortable: boolean;
    required: boolean;
    /**
     * 헤더에 <b>필터 버튼</b>이 서는가 — 생략하면 <b>없는 것</b>으로 본다.
     *
     * <p>선택 항목인 것은 <b>판이 아닌 헤더</b>가 있기 때문이다 — 트리 그리드의 계층
     * 컬럼(screen/menu/requirements.md)에는 필터 버튼이 없다. 빠뜨렸을 때 <i>덜 넓어지는</i> 쪽으로 떨어지는
     * 것이 맞다: 넓히는 것은 <b>잘리지 않게 하는</b> 일이라 과하면 낭비지만, 없는 버튼
     * 자리를 비워 두면 그 컬럼만 늘 뜬금없이 넓다.
     */
    filter?: boolean;
  },
): number {
  const glyphs = textWidth(text, font);
  if (glyphs === 0) return 0;
  return Math.ceil(
    glyphs
      + CELL_PADDING
      + (options.sortable ? ICON_WITH_GAP : 0)
      // 필터를 걸 수 있는 컬럼이면 <b>늘</b> 있다 — 걸렸을 때만이 아니다(위 머리말).
      + (options.filter === true ? ICON_WITH_GAP : 0)
      + (options.required ? REQUIRED_MARK : 0)
      + SLACK,
  );
}

/**
 * 이 글자가 차지할 폭(px) — <b>재지 못하면 0</b>이다.
 *
 * <p>내보내는 것은 <b>헤더 말고도 재야 할 것이 생겼기</b> 때문이다(2026-08-31 — screen/menu/requirements.md).
 * 트리의 계층 컬럼은 폭을 <i>선언</i> 하지 않고 <b>내용에서 낸다</b> — 들여쓰기가 폭을 먹는
 * 컬럼이라 숫자를 하나 박아 두면 얕은 트리에서는 남고 깊은 트리에서는 잘린다.
 *
 * <p>0 을 <i>폭이 없다</i> 로 읽지 않는다 — 캔버스가 없는 환경(jsdom)의 답이며, 부르는 쪽이
 * <b>선언한 값이나 폴백</b>으로 떨어져야 한다.
 */
export function textWidth(text: string, font: string): number {
  if (text === '') return 0;
  const key = `${font}\n${text}`;
  const hit = measured.get(key);
  if (hit !== undefined) return hit;

  const canvas = measureContext();
  if (canvas === null) return 0;
  canvas.font = font;
  const width = canvas.measureText(text).width;
  measured.set(key, width);
  return width;
}

function measureContext(): CanvasRenderingContext2D | null {
  if (probed) return context;
  probed = true;
  if (typeof document === 'undefined') return null;
  context = document.createElement('canvas').getContext('2d');
  return context;
}
