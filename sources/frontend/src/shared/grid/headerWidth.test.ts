import { beforeAll, describe, expect, it, vi } from 'vitest';
import { headerMinWidth, textWidth } from '@/shared/grid/headerWidth';

/**
 * 헤더가 잘리지 않을 최소 폭 — frontend/grid.md.
 *
 * <p><b>이 파일이 지키는 것은 더하는 몫 넷이다.</b> 값은 판의 테마 기본값에서 옮겨 적은
 * 것이고(`cellHorizontalPadding` 16 × 2 · `cellWidgetSpacing` 12 + `iconSize` 16 · 여유 4),
 * 어림하면 <b>아무 컬럼도 넓어지지 않는다</b> — 2026-08-31 에 실제로 그랬다.
 *
 * <p><b>그러고도 두 번 틀렸다</b>(2026-09-01). 여백을 Material 의 24(양쪽 48)로 읽었고,
 * <b>필터 버튼을 빠뜨렸다</b> — 판은 필터를 걸 수 있는 컬럼이면 <b>언제나</b> 그 버튼을
 * 그린다. 둘이 서로를 가려 합계가 우연히 비슷했고, 그래서 <b>필터 있는 컬럼은 계속
 * 잘렸다</b>.
 *
 * <p>그 실패가 조용하다는 것이 이 테스트의 존재 이유다. 몫을 줄이면 <b>증상이 나지 않고
 * 그냥 기능이 사라진다</b>.
 *
 * <p>jsdom 에는 캔버스가 없어 {@code getContext} 가 {@code null} 이다 — 글자 폭을 <b>글자
 * 수 × 14</b> 로 재는 가짜를 끼운다. 재는 방법이 아니라 <b>더하는 몫</b>을 보는 테스트이며,
 * 14 는 <b>14px 짜리 한글 한 글자</b>의 실제 폭에 가깝다(라틴은 그보다 좁다).
 */
const GLYPH = 14;
const FONT = '500 14px sans-serif';

/** 양쪽 여백 32 + 여유 4 — 정렬도 필터도 없는 칸이 쓰는 몫이다. */
const BARE = 36;
/** 아이콘 하나 + 그 앞의 간격 — 정렬 표시와 필터 버튼이 각각 이만큼이다. */
const ICON = 28;

const plain = { sortable: false, required: false, filter: false };

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: (text: string) => ({ width: text.length * GLYPH }),
  } as unknown as CanvasRenderingContext2D);
});

describe('헤더 최소 폭', () => {
  it('좌우 여백은 32px 이다 — 판의 cellHorizontalPadding 16 이 양쪽이다', () => {
    expect(headerMinWidth('가나', FONT, plain)).toBe(2 * GLYPH + BARE);
  });

  it('정렬 컬럼에는 28px 이 붙는다 — 화살표 16 과 그 앞의 간격 12', () => {
    expect(headerMinWidth('가나', FONT, { ...plain, sortable: true }))
      .toBe(2 * GLYPH + BARE + ICON);
  });

  /*
    2026-09-01 — 빠뜨렸던 몫. 판은 필터를 걸 수 있는 컬럼이면 언제나 헤더에 버튼을 그린다
    (`!suppressHeaderFilterButton && isFilterAllowed`). 우리는 컬럼 메뉴만 껐다.
  */
  it('필터를 걸 수 있는 컬럼에도 28px 이 붙는다 — 걸렸을 때만이 아니다', () => {
    expect(headerMinWidth('가나', FONT, { ...plain, filter: true }))
      .toBe(2 * GLYPH + BARE + ICON);
  });

  it('정렬과 필터가 함께면 둘 다 더한다', () => {
    expect(headerMinWidth('가나', FONT, { sortable: true, required: false, filter: true }))
      .toBe(2 * GLYPH + BARE + ICON + ICON);
  });

  it('필수 표시는 10px 이다 — CSS 가 붙이므로 글자 측정에 들어오지 않는다(frontend/grid.md)', () => {
    expect(headerMinWidth('가나', FONT, { ...plain, required: true }))
      .toBe(2 * GLYPH + BARE + 10);
  });

  /*
    실물의 회귀 — `계정 상태`(4글자 + 공백)는 선언 폭이 100 인데 잘렸다. 정렬은 없고
    필터는 있는 칸이며, 필터 몫을 빼면 100 을 넘지 못해 넓혀지지 않는다.
  */
  it('필터 있는 한글 다섯 글자는 선언 폭 100 을 넘어선다 — 계정 상태 컬럼', () => {
    expect(headerMinWidth('계정 상태', FONT, { ...plain, filter: true }))
      .toBeGreaterThan(100);
  });

  it('빈 헤더는 0 이다 — 커스텀 헤더 컴포넌트가 그리는 칸을 넓히지 않는다', () => {
    expect(headerMinWidth('', FONT, { sortable: true, required: true, filter: true })).toBe(0);
  });

  it('같은 글자를 두 번 재지 않는다 — 캐시가 같은 값을 낸다', () => {
    expect(textWidth('가나다', FONT)).toBe(textWidth('가나다', FONT));
  });
});
